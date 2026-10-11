import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderWithItems } from "@/types/database";
import { verifySquareSignature } from "@/lib/square/verifyWebhook";
import { syncSquareOrderPayment } from "@/lib/square/syncPayment";

// Needs the raw request body for signature checking and the Node crypto
// module, and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SquareWebhookEvent {
  type?: string;
  data?: {
    object?: {
      payment?: { order_id?: string };
      order_updated?: { order_id?: string };
      order_created?: { order_id?: string };
    };
  };
}

// POST /api/webhooks/square — Square calls this when a payment or order
// changes. Set up in the Square Developer Dashboard (Webhooks → Subscriptions)
// with the events payment.updated and order.updated, the notification URL
// https://shoprealaminos.com/api/webhooks/square, and the subscription's
// Signature Key saved as SQUARE_WEBHOOK_SIGNATURE_KEY.
//
// Security: (1) the HMAC signature over the raw body must match, and (2) even
// then we never trust the payload — we only take the Square order id out of it,
// then ask Square directly (our own API token) whether that order is paid, for
// the right amount, before finalizing anything. A forged request can't mark an
// order paid.
//
// Response codes matter: a 5xx makes Square retry later; a 2xx means "got it".
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifySquareSignature(rawBody, request.headers.get("x-square-hmacsha256-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: SquareWebhookEvent;
  try {
    event = JSON.parse(rawBody) as SquareWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }

  const obj = event.data?.object;
  const squareOrderId =
    obj?.payment?.order_id ?? obj?.order_updated?.order_id ?? obj?.order_created?.order_id ?? null;

  if (!squareOrderId) {
    // Events we don't act on (refunds, disputes, ...).
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("square_order_id", squareOrderId)
    .maybeSingle<OrderWithItems>();

  if (fetchError) {
    console.error("square webhook: order lookup failed", squareOrderId, fetchError.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!order) {
    // Not one of ours (another Square sale, or a test) — nothing to do.
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Already processed (redelivery, or the thank-you page / staff got there first).
  if (order.status !== "Awaiting Payment") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  const result = await syncSquareOrderPayment(admin, order);
  if (result.state === "failed") {
    // 409 = sold out / already handled and 400 = not payable: retrying won't
    // change it, so acknowledge and leave the order for staff. Anything else
    // is worth a retry.
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status === 409 || result.status === 400 ? 200 : 500 }
    );
  }
  return NextResponse.json({ ok: true, state: result.state });
}
