import { createHmac, timingSafeEqual } from "crypto";

// BTCPay signs every webhook delivery: header `BTCPay-Sig: sha256=<hex>`,
// where <hex> is HMAC-SHA256 of the RAW request body using the secret set on
// the webhook (BTCPAY_WEBHOOK_SECRET). Must be computed over the exact raw
// text — never over re-serialized JSON.
export function verifyBtcpaySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.BTCPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.trim().replace(/^sha256=/i, "");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
