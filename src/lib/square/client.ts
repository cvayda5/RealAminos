// Thin wrapper around Square's REST API — server-only (reads
// SQUARE_ACCESS_TOKEN). Only what this site needs: create a hosted payment
// link at checkout, and re-fetch a Square order to confirm it was really paid.
// Card details never touch this site — the customer pays on Square's own page.
//
// Environment variables (set in Vercel, never committed):
//   SQUARE_ACCESS_TOKEN            Square Developer Dashboard -> your app -> Credentials
//                                  (use the Sandbox token while testing, Production when live)
//   SQUARE_LOCATION_ID             Square Dashboard -> Account & Settings -> Business -> Locations
//   SQUARE_ENVIRONMENT             "production" (default) or "sandbox"
//   SQUARE_WEBHOOK_SIGNATURE_KEY   shown on the webhook subscription (see verifyWebhook.ts)
//   SQUARE_WEBHOOK_URL             optional; defaults to https://shoprealaminos.com/api/webhooks/square
//   SQUARE_API_VERSION             optional; pins the Square-Version header (if unset, Square uses
//                                  the API version set on your app in the Developer Dashboard)
//   NEXT_PUBLIC_SQUARE_ENABLED     "true" shows the "Pay by card" option in the cart
//                                  (leave unset until everything above is in place)

export interface SquareMoney {
  amount?: number;
  currency?: string;
}

export interface SquareOrder {
  id: string;
  location_id?: string;
  reference_id?: string;
  state?: "DRAFT" | "OPEN" | "COMPLETED" | "CANCELED" | string;
  total_money?: SquareMoney;
  net_amount_due_money?: SquareMoney;
  tenders?: { id?: string; type?: string; amount_money?: SquareMoney }[];
}

export interface SquarePaymentLink {
  id: string;
  orderId: string;
  url: string;
}

export function isSquareConfigured(): boolean {
  return !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

function config() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!token || !locationId) {
    throw new Error("Square is not configured (SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID).");
  }
  const baseUrl =
    process.env.SQUARE_ENVIRONMENT === "sandbox"
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";
  return { token, locationId, baseUrl, version: process.env.SQUARE_API_VERSION || "" };
}

async function squareFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { token, baseUrl, version } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(version ? { "Square-Version": version } : {}),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Square ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// Creates a Square-hosted checkout page for exactly `amountUsd`. The Square
// order is stamped with our own order id as reference_id so a payment can
// always be traced back to the right row.
export async function createSquarePaymentLink(input: {
  amountUsd: number;
  orderId: string;
  orderNumber: string;
  itemSummary: string;
  buyerEmail?: string;
  redirectUrl: string;
}): Promise<SquarePaymentLink> {
  const { locationId } = config();
  const cents = Math.round(input.amountUsd * 100);

  const body: Record<string, unknown> = {
    idempotency_key: `ra-${input.orderId}`,
    order: {
      location_id: locationId,
      reference_id: input.orderId,
      line_items: [
        {
          name: `RealAminos order ${input.orderNumber}`,
          quantity: "1",
          note: input.itemSummary.slice(0, 480),
          base_price_money: { amount: cents, currency: "USD" },
        },
      ],
    },
    checkout_options: {
      redirect_url: input.redirectUrl,
      ask_for_shipping_address: false,
      allow_tipping: false,
    },
    payment_note: input.orderNumber,
  };
  if (input.buyerEmail) body.pre_populated_data = { buyer_email: input.buyerEmail };

  const res = await squareFetch<{
    payment_link?: { id?: string; order_id?: string; url?: string; long_url?: string };
  }>("/v2/online-checkout/payment-links", { method: "POST", body: JSON.stringify(body) });

  const link = res.payment_link;
  const url = link?.url ?? link?.long_url;
  if (!link?.id || !link.order_id || !url) {
    throw new Error("Square returned an unexpected payment link response.");
  }
  return { id: link.id, orderId: link.order_id, url };
}

export async function getSquareOrder(squareOrderId: string): Promise<SquareOrder> {
  const res = await squareFetch<{ order?: SquareOrder }>(`/v2/orders/${encodeURIComponent(squareOrderId)}`);
  if (!res.order) throw new Error("Square returned no order.");
  return res.order;
}

// True only when Square itself says this order is fully paid, for exactly the
// amount we asked for, at our location, and it's stamped with our order id.
// Everything here comes from our own authenticated API call to Square — never
// from the contents of a webhook or a URL the customer could edit.
export function squareOrderIsPaid(
  sq: SquareOrder,
  expected: { cents: number; ourOrderId: string }
): boolean {
  const { locationId } = config();
  if (sq.state !== "COMPLETED") return false;
  if (sq.reference_id !== expected.ourOrderId) return false;
  if (sq.location_id !== locationId) return false;
  if (sq.total_money?.currency !== "USD" || sq.total_money?.amount !== expected.cents) return false;
  // Fully settled: nothing left due on the order.
  if ((sq.net_amount_due_money?.amount ?? 0) !== 0) return false;
  return true;
}
