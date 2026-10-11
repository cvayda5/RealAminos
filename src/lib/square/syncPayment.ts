// Asks Square (with our own API token) whether an "Awaiting Payment" Square
// order has really been paid, and if so finalizes it (stock, status →
// Processing, confirmation email). Called from two places so a payment is
// never missed: the Square webhook (instant) and the /thank-you page (covers
// a delayed or misconfigured webhook). finalizeOrderPayment() claims the order
// atomically, so calling this twice — or from both places at once — can never
// double-decrement stock.
import type { OrderWithItems } from "@/types/database";
import type { createAdminClient } from "@/lib/supabase/admin";
import { finalizeOrderPayment } from "@/lib/orders/finalizeZellePayment";
import { getSquareOrder, isSquareConfigured, squareOrderIsPaid } from "@/lib/square/client";

export type SquareSyncResult =
  | { state: "paid" }
  | { state: "pending" }
  | { state: "skipped" }
  | { state: "failed"; status: number; error: string };

export async function syncSquareOrderPayment(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderWithItems
): Promise<SquareSyncResult> {
  if (order.payment_method !== "square" || order.status !== "Awaiting Payment" || !order.square_order_id) {
    return { state: "skipped" };
  }
  if (!isSquareConfigured()) return { state: "skipped" };

  let sq;
  try {
    sq = await getSquareOrder(order.square_order_id);
  } catch (err) {
    console.error("square sync: could not fetch order", order.id, err);
    return { state: "failed", status: 502, error: "Could not verify the Square order." };
  }

  // No Square discount exists — what's due is exactly total + shipping.
  const cents = Math.round(((order.total ?? order.subtotal) + order.shipping_fee) * 100);
  if (!squareOrderIsPaid(sq, { cents, ourOrderId: order.id })) {
    return { state: "pending" };
  }

  const result = await finalizeOrderPayment(admin, order, null);
  if (!result.ok) {
    console.error("square sync: finalize failed", order.id, result.status, result.error);
    return { state: "failed", status: result.status, error: result.error };
  }
  return { state: "paid" };
}
