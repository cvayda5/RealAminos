// Sends the owner's "New Order" email exactly once per order, at the moment
// the customer reaches /thank-you (see src/app/thank-you/page.tsx) — or, for
// card and Bitcoin orders, when the payment auto-confirms (see
// finalizeOrderPayment), so the email still goes out if the customer closes
// the tab before the thank-you page loads.
//
// "Once" is enforced in the database: orders.admin_notified_at is claimed with
// an UPDATE that only matches while it's still null, so the thank-you page
// re-rendering (it refreshes itself while a payment is pending) or a webhook
// firing at the same time can never send two emails. If the send itself fails
// the claim is released so the next visit retries.
//
// Orders still "Awaiting Payment" are skipped — nothing has been paid or
// confirmed yet. Zelle is the exception in practice only because the Zelle
// customer's own "I've Sent My Zelle Payment" button moves the order to
// Processing before they land on /thank-you; the email then tells the owner
// to verify the money manually, since nothing has actually been checked.
import type { OrderWithItems } from "@/types/database";
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminOrderNotification } from "@/lib/email/sendAdminOrderNotification";

export async function notifyAdminNewOrder(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderWithItems
): Promise<void> {
  if (order.status === "Awaiting Payment") return;
  if (order.payment_method !== "zelle" && order.payment_method !== "bitcoin" && order.payment_method !== "square") {
    return;
  }

  try {
    const { data: claimed, error: claimError } = await admin
      .from("orders")
      .update({ admin_notified_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("admin_notified_at", null)
      .select("id");

    if (claimError) {
      console.error("notifyAdminNewOrder: could not claim", order.id, claimError.message);
      return;
    }
    if (!claimed || claimed.length === 0) return; // already sent

    const amount =
      Math.round(((order.total ?? order.subtotal) + order.shipping_fee - (order.zelle_discount_amount ?? 0)) * 100) /
      100;

    const sent = await sendAdminOrderNotification({
      orderNumber: order.order_number,
      paymentMethod: order.payment_method,
      awaitingPayment: false,
      manualConfirm: order.payment_method === "zelle",
      items: order.order_items.map((i) => ({ productName: i.product_name, size: i.size, qty: i.qty })),
      amountDue: amount,
      shipping: {
        name: order.shipping_name ?? "",
        city: order.shipping_city ?? "",
        state: order.shipping_state ?? "",
      },
    });

    if (!sent) {
      await admin.from("orders").update({ admin_notified_at: null }).eq("id", order.id);
    }
  } catch (err) {
    console.error("notifyAdminNewOrder failed", order.id, err);
  }
}
