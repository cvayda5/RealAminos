// Thin wrapper around Whop's checkout API. Whop's data model requires every
// "plan" (a price) to belong to a "product" (what Whop's dashboard calls an
// Access Pass) and to a company — there's no way to charge an arbitrary
// dollar amount with no product behind it at all. Rather than pre-creating a
// separate Whop product for every SKU we sell (which would mean keeping two
// catalogs in sync), we point every checkout at ONE generic product created
// once in the Whop dashboard, and override the price inline via the plan's
// initial_price on every request — the actual line-item breakdown the
// customer sees came from our own cart/checkout UI before they ever got to
// Whop, so the single generic product name on Whop's side doesn't matter.
//
// WHOP_API_KEY is a server-only secret (Bearer token) — never expose this in
// client code. Create one at your Whop dashboard's Developer > API Keys page
// with these scopes: create/read checkout configurations, create/read
// checkout requests, read payments, read changes to payments.
//
// WHOP_PRODUCT_ID is the one generic product's id (format "prod_..." or
// "pass_..."), created once by hand in the dashboard. WHOP_COMPANY_ID is
// your Whop business id (format "biz_..."), visible in the dashboard's URL.
//
// NOTE on company_id placement: two live errors from Whop's API pinned this
// down exactly. Sending company_id at the request's TOP LEVEL got rejected
// ("Cannot provide company_id for this configuration") — but omitting it
// entirely then got rejected too ("Missing required parameter:
// plan.company_id"). So it's required, but only nested inside the plan
// object, not at the top level.
const WHOP_API_BASE = "https://api.whop.com/api/v1";

interface CreateCheckoutParams {
  amount: number; // dollars, e.g. 42.50
  currency?: string;
  redirectUrl: string;
  metadata: Record<string, string>;
}

interface CreateCheckoutResult {
  purchaseUrl: string;
  whopCheckoutId: string;
}

export async function createWhopCheckout({
  amount,
  currency = "usd",
  redirectUrl,
  metadata,
}: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  const apiKey = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;

  if (!apiKey) {
    throw new Error("WHOP_API_KEY is not set.");
  }
  if (!productId) {
    throw new Error("WHOP_PRODUCT_ID is not set.");
  }
  if (!companyId) {
    throw new Error("WHOP_COMPANY_ID is not set.");
  }

  const res = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan: {
        company_id: companyId,
        product_id: productId,
        plan_type: "one_time",
        initial_price: amount,
        currency,
      },
      redirect_url: redirectUrl,
      metadata,
    }),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Fall through — json stays null, raw text still gets logged below.
  }

  if (!res.ok) {
    // Log the raw response server-side (visible in Vercel's function logs)
    // since Whop's exact error shape may vary — this is the fastest way to
    // diagnose a bad request without guessing blind.
    console.error("Whop checkout_configurations failed", res.status, text);
    throw new Error(
      json?.error?.message || json?.message || `Whop checkout creation failed (${res.status}).`
    );
  }

  // Whop's response wraps the created object; purchase_url/sessionId naming
  // has shifted between docs versions, so check a couple of likely spots
  // rather than assuming one exact shape.
  const purchaseUrl =
    json?.purchase_url || json?.data?.purchase_url || json?.url || json?.data?.url;
  const whopCheckoutId = json?.id || json?.data?.id;

  if (!purchaseUrl || !whopCheckoutId) {
    console.error("Whop checkout_configurations returned an unexpected shape", text);
    throw new Error("Whop did not return a checkout URL — see server logs for the raw response.");
  }

  return { purchaseUrl, whopCheckoutId };
}
