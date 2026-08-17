import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PendingCheckout } from "@/types/database";
import { sendOrderConfirmationEmail } from "@/lib/email/sendOrderConfirmation";
import { verifyWhopWebhook } from "@/lib/whop/verifyWebhook";

// POST /api/webhooks/whop — the only place a Whop-paid checkout actually
// turns into a real order. This is a public URL (anyone on the internet can
// POST to it), so signature verification isn't optional — without it,
// anyone could fabricate a "payment succeeded" event and get free product.
//
// Runs entirely on the service-role client: there's no user session on an
// incoming webhook request, so every write here has to use elevated
// privileges the same way point_transactions writes already do elsewhere in
// this codebase.
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyWhopWebhook(rawBody, request.headers)) {
    console.error("Whop webhook signature verification failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventType: string | undefined = event?.type;
  const data = event?.data ?? event;
  // Metadata's exact location isn't fully pinned down in Whop's docs across
  // versions — check the couple of spots it's most likely to show up rather
  // than assuming one shape.
  const metadata = data?.metadata ?? data?.checkout_configuration?.metadata ?? event?.metadata;
  const pendingCheckoutId: string | undefined = metadata?.pending_checkout_id;

  if (!pendingCheckoutId) {
    // Not every Whop webhook event is one we care about (or carries our
    // metadata) — acknowledge with 200 so Whop doesn't keep retrying an
    // event we were never going to act on.
    console.log("Whop webhook without a pending_checkout_id — ignoring.", eventType);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();
  const { data: pending, error: fetchError } = await admin
    .from("pending_checkouts")
    .select("*")
    .eq("id", pendingCheckoutId)
    .single<PendingCheckout>();

  if (fetchError || !pending) {
    console.error("Whop webhook referenced an unknown pending_checkout_id", pendingCheckoutId);
    return NextResponse.json({ error: "Unknown pending checkout." }, { status: 404 });
  }

  // Idempotency — Whop (like most webhook senders) can and will retry the
  // same event. If this checkout was already finalized (or already marked
  // failed), do nothing rather than double-create an order or double-refund
  // points.
  if (pending.status !== "pending") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  const isSuccess = eventType === "payment_succeeded";
  const isFailure = eventType === "payment_failed";

  if (isSuccess) {
    await finalizeOrder(pending, admin);
  } else if (isFailure) {
    await refundReservations(pending, admin);
    await admin.from("pending_checkouts").update({ status: "failed" }).eq("id", pending.id);
  }
  // Any other event type (payment.created, payment.pending, etc.) — nothing
  // to do yet, just acknowledge.

  return NextResponse.json({ ok: true });
}

async function finalizeOrder(pending: PendingCheckout, admin: ReturnType<typeof createAdminClient>) {
  const shipping = pending.shipping;

  // Uses the admin client (not a user session — there isn't one here), so
  // this is the one place in the codebase that creates an `orders` row
  // without going through the orders_insert_own RLS policy. That's
  // necessary and safe: pending_checkouts_insert_own already proved this
  // pending row genuinely belongs to pending.user_id back when it was
  // created under that user's own session.
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: pending.user_id,
      subtotal: pending.subtotal,
      discount_code: pending.discount_code,
      discount_percent: pending.discount_percent,
      total: pending.total,
      points_redeemed: pending.points_redeemed,
      shipping_fee: pending.shipping_fee,
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
    console.error("Whop webhook: failed to create order for pending checkout", pending.id, orderError?.message);
    return;
  }

  await admin.from("order_items").insert(
    pending.items.map((i) => ({
      order_id: order.id,
      product_name: i.productName,
      size: i.size,
      qty: i.qty,
      unit_price: i.unitPrice,
    }))
  );

  if (pending.reward_tx_ids.length > 0) {
    await admin.from("point_transactions").update({ order_id: order.id }).in("id", pending.reward_tx_ids);
  }

  const pointsEarned = Math.floor(pending.total);
  if (pointsEarned > 0) {
    await admin.from("point_transactions").insert({
      user_id: pending.user_id,
      points: pointsEarned,
      type: "earned",
      order_id: order.id,
      description: `Order ${order.order_number}`,
    });
  }

  await admin.from("pending_checkouts").update({ status: "completed" }).eq("id", pending.id);

  await sendOrderConfirmationEmail({
    toEmail: shipping.email,
    orderNumber: order.order_number,
    items: pending.items,
    subtotal: pending.subtotal,
    discountCode: pending.discount_code,
    discountPercent: pending.discount_percent,
    total: pending.total,
    shippingFee: pending.shipping_fee,
    shipping,
  });
}

// If the Whop checkout failed or expired, any reward points the customer had
// reserved for it need to go back to their balance — otherwise they'd lose
// those points for a purchase that never actually happened. Same refund
// mechanics as /api/points/refund (voiding the reservation, crediting an
// equal "earned" entry back), just triggered from the webhook side instead
// of a "remove from cart" click.
async function refundReservations(pending: PendingCheckout, admin: ReturnType<typeof createAdminClient>) {
  for (const txId of pending.reward_tx_ids) {
    const { data: transaction } = await admin
      .from("point_transactions")
      .select("*")
      .eq("id", txId)
      .single();

    if (!transaction || transaction.order_id || transaction.voided) {
      continue;
    }

    await admin.from("point_transactions").update({ voided: true }).eq("id", txId);
    await admin.from("point_transactions").insert({
      user_id: pending.user_id,
      points: Math.abs(transaction.points),
      type: "earned",
      order_id: null,
      description: `Refunded — payment did not complete (${transaction.description ?? "reward"})`,
    });
  }
}
