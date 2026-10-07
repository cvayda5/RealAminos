import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderWithItems } from "@/types/database";
import { verifyBtcpaySignature } from "@/lib/btcpay/verifyWebhook";
import { getBtcpayInvoice } from "@/lib/btcpay/client";
import { finalizeOrderPayment } from "@/lib/orders/finalizeZellePayment";

// Needs the raw request body for signature checking and the Node crypto
// module, and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BtcpayWebhookEvent {
  type?: string;
  invoiceId?: string;
  storeId?: string;
}

// POST /api/webhooks/btcpay — BTCPay Server calls this when an invoice
// changes state. Set up in BTCPay under Store → Settings → Webhooks with the
// events InvoiceSettled and InvoiceExpired, and the same secret as
// BTCPAY_WEBHOOK_SECRET.
//
// Security: (1) the HMAC signature over the raw body must match, and (2) even
// then we never trust the payload — for a "settled" event we re-fetch the
// invoice from BTCPay with our own API key and only finalize if BTCPay itself
// says it's Settled. A forged request can't mark an order paid.
//
// Response codes matter: a 5xx makes BTCPay retry later (what we want for a
// temporary database/network problem); a 2xx means "got it, don't retry".
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyBtcpaySignature(rawBody, request.headers.get("btcpay-sig"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: BtcpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as BtcpayWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }

  const invoiceId = event.invoiceId;
  if (!invoiceId || (event.type !== "InvoiceSettled" && event.type !== "InvoiceExpired")) {
    // Events we don't act on (InvoiceCreated, InvoiceReceivedPayment, ...).
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("btcpay_invoice_id", invoiceId)
    .maybeSingle<OrderWithItems>();

  if (fetchError) {
    console.error("btcpay webhook: order lookup failed", invoiceId, fetchError.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!order) {
    // Not one of ours (or a test invoice) — nothing to do, don't retry.
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Already processed (BTCPay redelivery, or staff got there first).
  if (order.status !== "Awaiting Payment") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  let invoice;
  try {
    invoice = await getBtcpayInvoice(invoiceId);
  } catch (err) {
    console.error("btcpay webhook: could not fetch invoice", invoiceId, err);
    return NextResponse.json({ error: "Could not verify invoice." }, { status: 502 });
  }

  if (event.type === "InvoiceSettled") {
    if (invoice.status !== "Settled") {
      console.warn("btcpay webhook: settled event but invoice status is", invoice.status, invoiceId);
      return NextResponse.json({ ok: true, ignored: true });
    }

    // The invoice amount was set by us at checkout; make sure it still
    // matches what this order should cost before releasing it.
    const expected = Math.round(((order.total ?? order.subtotal) + order.shipping_fee) * 100);
    const actual = Math.round(Number(invoice.amount) * 100);
    if (invoice.currency !== "USD" || actual !== expected) {
      console.error("btcpay webhook: invoice amount mismatch", order.id, invoice.amount, invoice.currency, expected);
      return NextResponse.json({ ok: true, ignored: true, reason: "amount mismatch" });
    }

    const result = await finalizeOrderPayment(admin, order, null);
    if (!result.ok) {
      console.error("btcpay webhook: finalize failed", order.id, result.status, result.error);
      // 409 = sold out / already handled: retrying won't change it, so
      // acknowledge and leave the order for staff (it stays "Awaiting
      // Payment" on /admin/orders). Anything else is worth a retry.
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status === 409 || result.status === 400 ? 200 : 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // InvoiceExpired: remove the unpaid order, but ONLY if no money arrived at
  // all (additionalStatus "None"). A partial or late payment is left for
  // staff to sort out by hand on /admin/orders.
  if (invoice.status === "Expired" && invoice.additionalStatus === "None") {
    const { error } = await admin
      .from("orders")
      .delete()
      .eq("id", order.id)
      .eq("status", "Awaiting Payment")
      .eq("payment_method", "bitcoin");
    if (error) {
      console.error("btcpay webhook: could not remove expired order", order.id, error.message);
      return NextResponse.json({ error: "Cleanup failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
