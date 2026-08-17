// Thin wrapper around Whop's checkout API. Whop is organized around a
// "plan" object rather than a free-form cart total, but it supports creating
// an inline, one-time plan at request time (instead of a pre-created
// dashboard product) — that's what lets us pass a server-computed dollar
// amount here instead of pointing at a fixed-price product configured ahead
// of time in the Whop dashboard.
//
// WHOP_API_KEY is a server-only secret (Bearer token) — never expose this in
// client code. Create one at your Whop dashboard's Developer > API Keys page
// with these scopes: create/read checkout configurations, create/read
// checkout requests, read payments, read changes to payments.
const WHOP_API_BASE = "https://api.whop.com/v5";

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
  if (!apiKey) {
    throw new Error("WHOP_API_KEY is not set.");
  }

  const res = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan: {
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
