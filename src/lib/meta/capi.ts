// Meta Conversions API — the server half of the Meta tracking setup.
//
// The browser pixel (see lib/meta/pixel.ts) can be blocked by ad blockers and
// privacy settings, and a Bitcoin / card customer may pay and never reach the
// thank-you page. So the sale is also reported from our server, the moment the
// payment is confirmed. The browser pixel and this server event share one
// event_id ("purchase_<order number>"), which is how Meta knows they are the
// same sale and counts it once.
//
// What is sent: the order value, currency and generic product IDs, plus the
// buyer's email / phone / name / address — each hashed with SHA-256 here, as
// Meta requires, so the plain values never leave our server. No product names.
//
// Needs META_CAPI_ACCESS_TOKEN (Vercel env var, server-only). Without it every
// function here quietly does nothing. See 0040_meta_tracking.sql for the two
// order columns this uses; until that migration is run the "send once" claim
// fails and nothing is sent (checkout is never affected either way).
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import type { OrderWithItems } from "@/types/database";
import type { createAdminClient } from "@/lib/supabase/admin";
import { META_PIXEL_ID } from "./config";

export interface MetaTracking {
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  ua?: string | null;
}

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";
const SOURCE_URL = "https://shoprealaminos.com/thank-you";

const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const COOKIE_ID = /^fb\.\d\.\d+\.[A-Za-z0-9._-]{1,200}$/;

// Called from a checkout route handler when the order is created: remembers the
// buyer's Meta browser IDs (the _fbp / _fbc cookies the pixel sets) and their
// IP + browser string, which is what lets Meta tie the later server-side
// Purchase back to the ad click. Never throws.
export function readMetaTracking(): MetaTracking {
  try {
    const c = cookies();
    const h = headers();
    const fbp = c.get("_fbp")?.value;
    const fbc = c.get("_fbc")?.value;
    const fwd = h.get("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || null;
    const ua = h.get("user-agent");
    return {
      fbp: fbp && COOKIE_ID.test(fbp) ? fbp : null,
      fbc: fbc && COOKIE_ID.test(fbc) ? fbc : null,
      ip: ip ? ip.slice(0, 64) : null,
      ua: ua ? ua.slice(0, 500) : null,
    };
  } catch {
    return {};
  }
}

function hashedUserData(order: OrderWithItems, t: MetaTracking | null | undefined) {
  const ud: Record<string, unknown> = {};
  const email = order.shipping_email?.trim().toLowerCase();
  if (email) ud.em = [sha(email)];

  const digits = (order.shipping_phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) ud.ph = [sha(`1${digits}`)];
  else if (digits.length === 11 && digits.startsWith("1")) ud.ph = [sha(digits)];

  const parts = (order.shipping_name ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts[0]) ud.fn = [sha(parts[0])];
  if (parts.length > 1) ud.ln = [sha(parts[parts.length - 1])];

  const city = (order.shipping_city ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (city) ud.ct = [sha(city)];
  const st = (order.shipping_state ?? "").trim().toLowerCase().slice(0, 2);
  if (st) ud.st = [sha(st)];
  const zip = (order.shipping_zip ?? "").trim().slice(0, 5);
  if (zip) ud.zp = [sha(zip)];
  ud.country = [sha("us")];

  if (order.user_id) ud.external_id = [sha(order.user_id)];
  if (t?.fbp) ud.fbp = t.fbp;
  if (t?.fbc) ud.fbc = t.fbc;
  if (t?.ip) ud.client_ip_address = t.ip;
  if (t?.ua) ud.client_user_agent = t.ua;
  return ud;
}

// Reports the Purchase for a paid order — once. The "once" is claimed in the
// database (orders.meta_purchase_sent_at is set by an UPDATE that only matches
// while it is still null), so the thank-you page re-rendering and a payment
// webhook arriving together can never send two. If Meta can't be reached the
// claim is released so the next call retries; and since the event_id is fixed,
// even a repeat send could not be double-counted by Meta.
export async function sendMetaPurchaseOnce(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderWithItems
): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) return;
  if (order.status === "Awaiting Payment") return;

  try {
    const { data: claimed, error: claimError } = await admin
      .from("orders")
      .update({ meta_purchase_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("meta_purchase_sent_at", null)
      .select("id, meta_tracking");
    if (claimError) {
      console.warn("sendMetaPurchaseOnce: could not claim (has 0040_meta_tracking.sql been run?)", claimError.message);
      return;
    }
    if (!claimed || claimed.length === 0) return; // already sent

    const tracking = (claimed[0] as { meta_tracking?: MetaTracking | null }).meta_tracking ?? null;
    const value =
      Math.round(((order.total ?? order.subtotal) + order.shipping_fee - (order.zelle_discount_amount ?? 0)) * 100) / 100;

    const ids = Array.from(new Set(order.order_items.map((i) => i.product_id).filter((x): x is string => !!x)));
    const contents = order.order_items
      .filter((i) => i.product_id)
      .map((i) => ({ id: i.product_id as string, quantity: i.qty, item_price: i.unit_price }));
    const numItems = order.order_items.reduce((s, i) => s + i.qty, 0);

    const event = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `purchase_${order.order_number}`,
      event_source_url: SOURCE_URL,
      // Meta requires a browser user-agent for "website" events; if we somehow
      // don't have one, report it as a generic event instead of being rejected.
      action_source: tracking?.ua ? "website" : "other",
      user_data: hashedUserData(order, tracking),
      custom_data: {
        currency: "USD",
        value,
        order_id: order.order_number,
        content_type: "product",
        content_ids: ids,
        contents,
        num_items: numItems,
      },
    };

    const body: Record<string, unknown> = { data: [event], access_token: token };
    if (process.env.META_CAPI_TEST_EVENT_CODE) body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    let ok = false;
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      ok = res.ok;
      if (!ok) console.error("sendMetaPurchaseOnce: Meta rejected the event", res.status, (await res.text()).slice(0, 400));
    } catch (err) {
      console.error("sendMetaPurchaseOnce: request failed", err);
    } finally {
      clearTimeout(timer);
    }

    if (!ok) {
      await admin.from("orders").update({ meta_purchase_sent_at: null }).eq("id", order.id);
    }
  } catch (err) {
    console.error("sendMetaPurchaseOnce failed", order.id, err);
  }
}
