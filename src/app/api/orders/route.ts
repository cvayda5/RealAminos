import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NewOrderPayload, PointTransaction } from "@/types/database";
import { sendOrderConfirmationEmail } from "@/lib/email/sendOrderConfirmation";
import { calculateShippingFee } from "@/lib/shipping/rate";

// POST /api/orders — creates an order + its line items for the signed-in
// user. Uses the user's own session (not the service role), so the
// "orders_insert_own" RLS policy is what actually stops one user from
// creating an order under someone else's account — this route can't bypass
// that even with a bug, because it never gets elevated privileges.
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

  // A cart made entirely of points-redeemed rewards can't check out on its
  // own — there has to be at least one item actually being paid for.
  const hasPaidItem = body.items.some((i) => !i.pointTransactionId);
  if (!hasPaidItem) {
    return NextResponse.json(
      { error: "Add at least one item you're paying for to check out — a cart can't be only free, points-redeemed rewards." },
      { status: 400 }
    );
  }

  // No payment processor is wired up yet, but every order still has to ship
  // somewhere — these fields are required even though nothing charges a
  // card yet, so the data is real and usable the moment a processor is
  // connected later.
  const shipping = body.shipping;
  const required: (keyof typeof shipping)[] = ["name", "phone", "email", "addressLine1", "city", "state", "zip"];
  const missing = shipping ? required.filter((field) => !shipping[field]?.toString().trim()) : required;
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required shipping info: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Reward items (redeemed with points on /points, added to the cart from
  // there) each carry the id of the point_transactions row that already
  // reserved the points for them. That reservation is re-verified here —
  // still belongs to this user, still an un-spent, un-voided redemption —
  // and its price is always forced to $0 server-side no matter what the
  // client sent, the same way the discount percent below is never trusted
  // from the client.
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

  // The authoritative price for every line — reward items are always $0
  // here regardless of whatever unitPrice the client's cart state had.
  const normalizedItems = body.items.map((i) => ({
    ...i,
    unitPrice: i.pointTransactionId ? 0 : i.unitPrice,
  }));

  const subtotal = normalizedItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const pointsRedeemedTotal = [...reservationById.values()].reduce((sum, r) => sum + Math.abs(r.points), 0);

  // Free at $200+ of raw product subtotal (before any discount code), a
  // flat zone-estimated rate below that — see src/lib/shipping/rate.ts.
  // Reward (points-redeemed) lines are already $0 in `subtotal` above, so
  // they never help an order reach the free-shipping threshold.
  const shippingFee = calculateShippingFee(subtotal, shipping.state);

  // Only the discount CODE is trusted from the client — the percent it's
  // worth is always looked up fresh here, never taken from the request
  // body. Without this, editing the page's JavaScript in devtools could let
  // someone claim any discount they want. Uses the service-role client for
  // the same reason /api/discount-codes/validate does: there's no
  // customer-facing RLS policy for reading discount_codes.
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
    }))
  );

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Link each reservation to the now-real order — this both records which
  // order a redemption paid for, and (via the order_id-must-be-null check
  // above and in /api/points/refund) permanently stops it from being
  // refunded again.
  if (rewardTxIds.length > 0) {
    await admin.from("point_transactions").update({ order_id: order.id }).in("id", rewardTxIds);
  }

  // Award rewards points — 1 point per dollar actually paid (after any
  // discount), rounded down so a partial dollar never rounds up in the
  // customer's favor. Uses the service-role client because there's no
  // client-writable insert policy on point_transactions (see
  // 0007_points.sql) — points are only ever credited by the server, after
  // the order itself is already safely recorded.
  const pointsEarned = Math.floor(total);
  if (pointsEarned > 0) {
    await admin.from("point_transactions").insert({
      user_id: user.id,
      points: pointsEarned,
      type: "earned",
      order_id: order.id,
      description: `Order ${order.order_number}`,
    });
  }

  // Fire the confirmation email after the order is safely in the database.
  // sendOrderConfirmationEmail swallows its own errors and returns a plain
  // boolean rather than throwing, so a bad API key or a Resend outage never
  // turns into a 500 for an order that already succeeded — the customer
  // still gets their order, just not the email, and it's logged server-side
  // for you to notice.
  await sendOrderConfirmationEmail({
    toEmail: shipping.email,
    orderNumber: order.order_number,
    items: normalizedItems,
    subtotal,
    discountCode,
    discountPercent,
    total,
    shippingFee,
    shipping,
  });

  return NextResponse.json({ order }, { status: 201 });
}

// GET /api/orders — the signed-in user's own orders (JSON). Handy for
// hooking a real frontend cart/checkout up to this later instead of using
// the Server Component page directly.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data });
}
