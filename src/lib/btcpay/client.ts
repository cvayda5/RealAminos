// Thin wrapper around BTCPay Server's Greenfield API — server-only (reads
// BTCPAY_API_KEY). Only the two calls this site needs: create an invoice at
// checkout, and re-fetch one when a webhook claims it was paid.
//
// Required environment variables (set in Vercel, never committed):
//   BTCPAY_URL            e.g. https://your-store.example-host.com  (no trailing slash needed)
//   BTCPAY_STORE_ID       the store's id, shown in BTCPay under Store → Settings
//   BTCPAY_API_KEY        API key with ONLY these permissions:
//                           btcpay.store.cancreateinvoice
//                           btcpay.store.canviewinvoices
//   BTCPAY_WEBHOOK_SECRET the secret you typed in when creating the webhook (see verifyWebhook.ts)

export type BtcpayInvoiceStatus = "New" | "Processing" | "Settled" | "Expired" | "Invalid";
export type BtcpayAdditionalStatus = "None" | "PaidLate" | "PaidPartial" | "Marked" | "Invalid" | "PaidOver";

export interface BtcpayInvoice {
  id: string;
  status: BtcpayInvoiceStatus;
  additionalStatus: BtcpayAdditionalStatus;
  amount: string;
  currency: string;
  checkoutLink: string;
  metadata?: { orderId?: string; orderNumber?: string; [key: string]: unknown };
}

export function isBtcpayConfigured(): boolean {
  return !!(process.env.BTCPAY_URL && process.env.BTCPAY_STORE_ID && process.env.BTCPAY_API_KEY);
}

function config() {
  const url = process.env.BTCPAY_URL?.replace(/\/+$/, "");
  const storeId = process.env.BTCPAY_STORE_ID;
  const apiKey = process.env.BTCPAY_API_KEY;
  if (!url || !storeId || !apiKey) {
    throw new Error("BTCPay is not configured (BTCPAY_URL, BTCPAY_STORE_ID, BTCPAY_API_KEY).");
  }
  return { url, storeId, apiKey };
}

async function btcpayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, apiKey } = config();
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      Authorization: `token ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`BTCPay ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function createBtcpayInvoice(input: {
  amountUsd: number;
  orderId: string;
  orderNumber: string;
  buyerEmail?: string;
  redirectUrl: string;
  expirationMinutes?: number;
}): Promise<BtcpayInvoice> {
  const { storeId } = config();
  return btcpayFetch<BtcpayInvoice>(`/api/v1/stores/${storeId}/invoices`, {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountUsd.toFixed(2),
      currency: "USD",
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        ...(input.buyerEmail ? { buyerEmail: input.buyerEmail } : {}),
      },
      checkout: {
        redirectURL: input.redirectUrl,
        redirectAutomatically: false,
        expirationMinutes: input.expirationMinutes ?? 60,
      },
    }),
  });
}

export async function getBtcpayInvoice(invoiceId: string): Promise<BtcpayInvoice> {
  const { storeId } = config();
  return btcpayFetch<BtcpayInvoice>(`/api/v1/stores/${storeId}/invoices/${encodeURIComponent(invoiceId)}`);
}
