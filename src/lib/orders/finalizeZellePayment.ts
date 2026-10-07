// Shared by every way an "Awaiting Payment" order can actually get paid:
//  - Bitcoin: the BTCPay webhook (src/app/api/webhooks/btcpay/route.ts) the
//    moment an invoice settles, or staff's button as a fallback
// Zelle orders get paid two ways:
//  - the customer's own "I've Sent My Zelle Payment" button
//    (src/app/api/orders/[id]/mark-paid/route.ts), gated to a 20-minute
//    window from order creation
//  - staff's "Mark Paid & Fulfill" button on /admin/orders
//    (src/app/api/admin/orders/[id]/mark-paid/route.ts), which has no time
//    limit
//
// Same side effects either way — stock decrement, points, status flip to
// Processing, confirmation email — kept in one place so the two paths can
// never drift apart. See 0019_zelle_self_mark_paid.sql for the full
// reasoning on why this replaced the old "stock only moves once staff
// click a button, whenever that happens to be" flow.

import type { OrderWithItems } from "@/types/database";
import { sendOrderConfirmationEmail } from "@/lib/email/sendOrderConfirmation";
import type { createAdminClient } from "@/lib/supabase/admin";

export const ZELLE_PAYMENT_WINDOW_MINUTES = 20;

export function zelleDeadline(order: Pick<OrderWithItems, "created_at">): Date {
  return new Date(new Date(order.created_at).getTime() + ZELLE_PAYMENT_WINDOW_MINUTES * 60 * 1000);
}

// Only meaningful for the customer's self-service path — staff's
// "Mark Paid & Fulfill" button never checks this, on purpose (see file
// comment above).
export function isZellePaymentWindowExpired(order: Pick<OrderWithItems, "created_at">): boolean {
  return Date.now() > zelleDeadline(order).getTime();
}

type FinalizeResult = { ok: true } | { ok: false; status: number; error: string };

// Kept under its old name so the existing Zelle callers don't change.
export async function finalizeZellePayment(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderWithItems,
  markedPaidBy: "customer" | "staff"
): Promise<FinalizeResult> {
  if (order.payment_method !== "zelle") {
    return { ok: false, status: 400, error: "This order isn't an unpaid Zelle order — nothing to mark paid." };
  }
  return finalizeOrderPayment(admin, order, markedPaidBy);
}

// Works for both Zelle and Bitcoin orders. For Bitcoin, markedPaidBy is
// null when BTCPay's webhook confirmed the payment automatically (and
// zelle_marked_paid_by is only ever written for Zelle orders).
export async function finalizeOrderPayment(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderWithItems,
  markedPaidBy: "customer" | "staff" | null
): Promise<FinalizeResult> {
  if ((order.payment_method !== "zelle" && order.payment_method !== "bitcoin") || order.status !== "Awaiting Payment") {
    return { ok: false, status: 400, error: "This order isn't an unpaid Zelle or Bitcoin order — nothing to mark paid." };
  }

  // Claim the order first, atomically: the UPDATE only matches while it's
  // still "Awaiting Payment", so if two requests race (a webhook delivered
  // twice, or a webhook plus a staff click) only one gets past this point and
  // stock can never be decremented twice. Reverted below if stock can't be
  // taken.
  // This is what makes the order take the same time to fulfill as any other
  // — it drops into the same Processing → Shipped → Delivered timeline.
  const claim: Record<string, unknown> = { status: "Processing" };
  if (order.payment_method === "zelle" && markedPaidBy) claim.zelle_marked_paid_by = markedPaidBy;

  const { data: claimed, error: claimError } = await admin
    .from("orders")
    .update(claim)
    .eq("id", order.id)
    .eq("status", "Awaiting Payment")
    .select("id");

  if (claimError) {
    return { ok: false, status: 500, error: claimError.message };
  }
  if (!claimed || claimed.length === 0) {
    return { ok: false, status: 409, error: "This order was already marked paid." };
  }

  // Resolve each line's real product_variants row the same way the old
  // admin-only version of this did — order_items.product_id was resolved
  // and stored once at checkout time (0013_zelle_payments.sql).
  const items: { variant_id: string; qty: number }[] = [];
  for (const item of order.order_items) {
    if (!item.product_id) {
      console.error("finalizeZellePayment: order_item missing product_id, can't decrement stock", order.id, item.id);
      continue;
    }
    const { data: variant } = await admin
      .from("product_variants")
      .select("id")
      .eq("product_id", item.product_id)
      .eq("size", item.size)
      .maybeSingle();

    if (!variant) {
      console.error("finalizeZellePayment: could not resolve variant to decrement stock", order.id, item.id);
      continue;
    }
    items.push({ variant_id: variant.id, qty: item.qty });
  }

  // All-or-nothing across every line in the order — see
  // decrement_variants_stock_safe() in 0019_zelle_self_mark_paid.sql. If
  // something in this order sold out while the Zelle payment was in
  // flight, nothing decrements and the order is left exactly as it was —
  // it needs a human (that's what the error message below asks for),
  // since the customer already believes they've paid.
  if (items.length > 0) {
    const { error: decrementError } = await admin.rpc("decrement_variants_stock_safe", {
      p_items: items,
    });
    if (decrementError) {
      console.error("finalizeZellePayment: stock decrement failed", order.id, decrementError.message);
      await admin
        .from("orders")
        .update({ status: "Awaiting Payment", ...(order.payment_method === "zelle" ? { zelle_marked_paid_by: null } : {}) })
        .eq("id", order.id);
      return {
        ok: false,
        status: 409,
        error:
          "One or more items in this order sold out before the payment could be confirmed, so it can't be completed automatically. Contact info@shoprealaminos.com with the order number to sort out a refund or substitute.",
      };
    }
  }

  // Points are NOT awarded here anymore — see awardZellePointsOnShip below
  // for why. This step only ever confirms the order is finalized/paid
  // enough to start fulfillment; it never means the payment itself has
  // actually been checked against real Zelle activity (the customer's own
  // "I've Sent My Zelle Payment" button reaches this exact same code with
  // zero verification — that's the whole point of it being self-service).

  if (order.shipping_email) {
    await sendOrderConfirmationEmail({
      toEmail: order.shipping_email,
      orderNumber: order.order_number,
      items: order.order_items.map((i) => ({
        productName: i.product_name,
        size: i.size,
        qty: i.qty,
        unitPrice: i.unit_price,
      })),
      subtotal: order.subtotal,
      discountCode: order.discount_code,
      discountPercent: order.discount_percent,
      total: order.total ?? order.subtotal,
      shippingFee: order.shipping_fee,
      shipping: {
        name: order.shipping_name ?? "",
        addressLine1: order.shipping_address_line1 ?? "",
        addressLine2: order.shipping_address_line2 ?? undefined,
        city: order.shipping_city ?? "",
        state: order.shipping_state ?? "",
        zip: order.shipping_zip ?? "",
      },
    });
  }

  return { ok: true };
}

// Awards the points a Zelle order earned, but only once staff have actually
// verified the money showed up and moved the order to Shipped — not at
// Processing (see the removed block above finalizeZellePayment for why that
// used to happen too early). Card/Whop orders don't need this: their points
// are already awarded at real, webhook-verified payment time in
// src/app/api/webhooks/whop/route.ts, so this function is a no-op for
// anything that isn't a Zelle or Bitcoin order (both are awarded here, at ship time, after payment is verified).
//
// Safe to call on every Shipped transition, including ones that aren't the
// very first — callers are expected to already guard with
// `previousStatus !== "Shipped"` (same guard the shipped-email send uses) so
// this only ever runs once per order, but there's no separate "have we
// already paid out points for this order" check here beyond that, so don't
// call this from anywhere that could re-fire on an already-Shipped order.
export async function awardZellePointsOnShip(
  admin: ReturnType<typeof createAdminClient>,
  order: Pick<OrderWithItems, "id" | "order_number" | "user_id" | "payment_method" | "total" | "subtotal">
): Promise<void> {
  if (order.payment_method !== "zelle" && order.payment_method !== "bitcoin") return;

  const pointsEarned = Math.floor(order.total ?? order.subtotal);
  if (pointsEarned <= 0) return;

  const { error } = await admin.from("point_transactions").insert({
    user_id: order.user_id,
    points: pointsEarned,
    type: "earned",
    order_id: order.id,
    description: `Order ${order.order_number}`,
  });

  if (error) {
    console.error("awardZellePointsOnShip: failed to insert point_transactions row", order.id, error.message);
  }
}
