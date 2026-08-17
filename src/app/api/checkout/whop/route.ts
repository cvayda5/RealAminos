import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NewOrderPayload, PointTransaction } from "@/types/database";
import { calculateShippingFee } from "@/lib/shipping/rate";
import { createWhopCheckout } from "@/lib/whop/client";

// POST /api/checkout/whop — validates the cart exactly the way /api/orders
// does (same reservation checks, same server-side discount/shipping/price
// recomputation — never trust the client for any of this), but instead of
// creating a real order immediately, it freezes that computed pricing into a
// `pending_checkouts` row and hands back a Whop-hosted checkout URL. The real
// order only gets created once Whop confirms payment via webhook (see
// /api/webhooks/whop) — this route never touches the `orders` table at all.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json()) as NewOrderPayload;
  if (!body.items?.length) {
    return NextResponse.json({ error: "Order must include at least one item." }, { status: 400 });
  }

  const hasPaidItem = body.items.some((i) => !i.pointTransactionId);
  if (!hasPaidItem) {
    return NextResponse.json(
      { error: "Add at least one item you're paying for to check out — a cart can't be only free, points-redeemed rewards." },
      { status: 400 }
    );
  }

  const shipping = body.shipping;
  const required: (keyof typeof shipping)[] = ["name", "phone", "email", "addressLine1", "city", "state", "zip"];
  const missing = shipping ? required.filter((field) => !shipping[field]?.toString().trim()) : required;
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required shipping info: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Same reservation re-verification as /api/orders — still belongs to this
  // user, still un-spent, un-voided. We don't link these to anything yet
  // (that only happens once payment is confirmed), just confirm they're
  // still valid to spend right now.
  const rewardTxIds = [...new Set(body.items.map((i) => i.pointTransactionId).filter(Boolean))] as string[];
  const admin = createAdminClient();
  const reservationById = new Map<string, PointTransaction>();

  if (rewardTxIds.length > 0) {
    const { data: reservations, error: resError } = await admin
      .from("point_transactions")
      .select("*")
      .in("id", rewardTxIds)
      .returns<PointTransaction[]>();

    if (resError) {
      return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    for (const id of rewardTxIds) {
      const found = reservations?.find((r) => r.id === id);
      if (!found || found.user_id !== user.id || found.type !== "redeemed" || found.order_id || found.voided) {
        return NextResponse.json(
          { error: "One of your redeemed rewards is no longer valid — remove it from your cart and try again." },
          { status: 400 }
        );
      }
      reservationById.set(id, found);
    }
  }

  const normalizedItems = body.items.map((i) => ({
    ...i,
    unitPrice: i.pointTransactionId ? 0 : i.unitPrice,
  }));

  const subtotal = normalizedItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const pointsRedeemedTotal = [...reservationById.values()].reduce((sum, r) => sum + Math.abs(r.points), 0);
  const shippingFee = calculateShippingFee(subtotal, shipping.state);

  let discountCode: string | null = null;
  let discountPercent = 0;
  const requestedCode = body.discountCode?.trim().toUpperCase();
  if (requestedCode) {
    const { data: found } = await admin
      .from("discount_codes")
      .select("code, percent_off")
      .ilike("code", requestedCode)
      .eq("is_active", true)
      .maybeSingle();

    if (!found) {
      return NextResponse.json(
        { error: "That discount code is no longer valid — remove it and try again." },
        { status: 400 }
      );
    }
    discountCode = found.code;
    discountPercent = found.percent_off;
  }

  const total = Math.round(subtotal * (1 - discountPercent / 100) * 100) / 100;
  const grandTotal = Math.round((total + shippingFee) * 100) / 100;

  // Insert under the customer's own session — pending_checkouts_insert_own
  // (see 0010_whop_checkout.sql) is what actually enforces user_id can't be
  // spoofed, the same way orders_insert_own does for /api/orders.
  const { data: pending, error: pendingError } = await supabase
    .from("pending_checkouts")
    .insert({
      user_id: user.id,
      items: normalizedItems,
      shipping,
      discount_code: discountCode,
      discount_percent: discountPercent,
      subtotal,
      shipping_fee: shippingFee,
      total,
      points_redeemed: pointsRedeemedTotal,
      reward_tx_ids: rewardTxIds,
    })
    .select()
    .single();

  if (pendingError || !pending) {
    return NextResponse.json({ error: pendingError?.message ?? "Could not start checkout." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;

  try {
    const { purchaseUrl, whopCheckoutId } = await createWhopCheckout({
      amount: grandTotal,
      redirectUrl: `${origin}/checkout/complete?pending=${pending.id}`,
      metadata: { pending_checkout_id: pending.id },
    });

    // Service-role update — pending_checkouts has no customer-facing update
    // policy at all, same as point_transactions.
    await admin.from("pending_checkouts").update({ whop_checkout_id: whopCheckoutId }).eq("id", pending.id);

    return NextResponse.json({ purchaseUrl }, { status: 201 });
  } catch (err) {
    // Don't leave an orphaned pending_checkouts row behind if Whop itself
    // failed to create the session.
    await admin.from("pending_checkouts").delete().eq("id", pending.id);
    const message = err instanceof Error ? err.message : "Could not reach Whop.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
