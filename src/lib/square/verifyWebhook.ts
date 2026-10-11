import { createHmac, timingSafeEqual } from "crypto";

// Where Square delivers webhooks. Must match the "Notification URL" typed into
// the webhook subscription in the Square Developer Dashboard EXACTLY (scheme,
// host, path, no trailing slash) — Square signs the URL together with the body.
export function squareWebhookUrl(): string {
  return process.env.SQUARE_WEBHOOK_URL || "https://shoprealaminos.com/api/webhooks/square";
}

// Square signs every webhook: header `x-square-hmacsha256-signature` is the
// base64 HMAC-SHA256, keyed with the subscription's Signature Key
// (SQUARE_WEBHOOK_SIGNATURE_KEY), of  notificationUrl + rawBody.  Must be
// computed over the exact raw text — never over re-serialized JSON.
export function verifySquareSignature(rawBody: string, signatureHeader: string | null): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signatureHeader) return false;

  const expected = createHmac("sha256", key).update(squareWebhookUrl() + rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
