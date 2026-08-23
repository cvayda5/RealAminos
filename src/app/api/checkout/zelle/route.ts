import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NewOrderPayload, PointTransaction } from "@/types/database";
import { calculateShippingFee } from "@/lib/shipping/rate";
import { resolveVariant } from "@/lib/inventory/resolveVariant";

// 5% off for choosing Zelle over a card — in exchange for us not getting
// instant payment confirmation the way Whop gives us. See the big comment
// on 0013_zelle_payments.sql for how this fits into the order lifecycle.
const ZELLE_DISCOUNT_RATE = 0.05;

// POST /api/checkout/zelle — validates the cart exactly the same way
// /api/checkout/whop does (same stock check, same reward-reservation
// re-verification, same server-side discount-code/shipping recomputation —
// never trust the client for any of this). The difference from Whop: there's
// no external checkout session to redirect to, so this creates a REAL
// `orders` row immediately, under the customer's own session (same RLS
// pattern the old /api/orders used), with status "Awaiting Payment". Stock,
// earned points, and the confirmation email are all deferred until staff
// confirm the Zelle payment actually arrived and click "Mark Paid & Fulfill"
// — see /api/admin/orders/[id]/mark-paid.
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

  const admin = createAdminClient();

  // Same point-in-time stock check as /api/checkout/whop — see that file's
  // comment for why this isn't a hold/reservation. Also resolve+cache each
  // line's real product_id here so the order_items insert below doesn't
  // have to re-query for it.
  const resolvedProductIdByLine = new Map<string, string>();
  for (const item of body.items) {
    const variant = await resolveVariant(admin, item);
    if (!variant) {
      return NextResponse.json(
        { error: `${item.productName} (${item.size}) is no longer available.` },
        { status: 400 }
      );
    }
    if (variant.stock < item.qty) {
      return NextResponse.json(
        {
          error:
            variant.stock === 0
              ? `${item.productName} (${item.size}) is currently out of stock.`
              : `Only ${variant.stock} left of ${item.productName} (${item.size}) — lower the quantity in your cart.`,
        },
        { status: 400 }
      );
    }
    resolvedProductIdByLine.set(item.pointTransactionId ?? `${item.productId}::${item.size}`, variant.product_id);
  }

  const rewardTxIds = [...new Set(body.items.map((i) => i.pointTransactionId).filter(Boolean))] as string[];
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
  const preZelleGrandTotal = Math.round((total + shippingFee) * 100) / 100;
  const zelleDiscountAmount = Math.round(preZelleGrandTotal * ZELLE_DISCOUNT_RATE * 100) / 100;
  const amountDue = Math.round((preZelleGrandTotal - zelleDiscountAmount) * 100) / 100;

  // Insert under the customer's own session — orders_insert_own (see
  // 0001_init.sql) is what actually enforces user_id can't be spoofed. This
  // is a REAL order row, not a pending one, unlike the Whop flow — there's
  // no external payment session to wait on before we know "the customer
  // committed to this," just a promise to Zelle the money with the order
  // number in the note.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      subtotal,
      discount_code: discountCode,
      discount_percent: discountPercent,
      total,
      points_redeemed: pointsRedeemedTotal,
      shipping_fee: shippingFee,
      payment_method: "zelle",
      zelle_discount_amount: zelleDiscountAmount,
      status: "Awaiting Payment",
      shipping_name: shipping.name,
      shipping_phone: shipping.phone,
      shipping_email: shipping.email,
      shipping_address_line1: shipping.addressLine1,
      shipping_address_line2: shipping.addressLine2 || null,
      shipping_city: shipping.city,
      shipping_state: shipping.state,
      shipping_zip: shipping.zip,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Could not create order." }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    normalizedItems.map((i) => ({
      order_id: order.id,
      product_name: i.productName,
      size: i.size,
      qty: i.qty,
      unit_price: i.unitPrice,
      product_id: resolvedProductIdByLine.get(i.pointTransactionId ?? `${i.productId}::${i.size}`) ?? null,
    }))
  );

  if (itemsError) {
    // Best-effort cleanup so a failed item insert doesn't leave an empty
    // "ghost" order sitting in Awaiting Payment forever.
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Link the reservations to the real order right away (unlike Whop, which
  // waits for payment confirmation) — this order already exists for real,
  // it's just unpaid. Known tradeoff, not fixed in this pass: if this
  // specific Zelle order is never paid and never fulfilled, these points
  // are gone rather than automatically refunded — same as if the reward had
  // actually been used. A "Cancel & Refund" admin action would close that
  // gap later if it comes up.
  if (rewardTxIds.length > 0) {
    await admin.from("point_transactions").update({ order_id: order.id }).in("id", rewardTxIds);
  }

  return NextResponse.json(
    {
      orderNumber: order.order_number,
      amountDue,
      zelleDiscountAmount,
      grandTotalBeforeDiscount: preZelleGrandTotal,
    },
    { status: 201 }
  );
}
