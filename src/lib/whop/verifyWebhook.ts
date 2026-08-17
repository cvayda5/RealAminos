import { createHmac, timingSafeEqual } from "crypto";

// Whop signs webhooks the same way Svix-based providers do: sign
// "{webhook-id}.{webhook-timestamp}.{raw body}" with HMAC-SHA256 using the
// webhook secret, base64-encoded, prefixed "v1,". We verify it ourselves here
// rather than trusting the payload, since /api/webhooks/whop is a public URL
// anyone on the internet can POST to — signature verification is what
// actually proves a request came from Whop and not an attacker trying to
// fabricate a "payment succeeded" event to get free product.
export function verifyWhopWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("WHOP_WEBHOOK_SECRET is not set — refusing to trust any webhook.");
    return false;
  }

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");

  if (!id || !timestamp || !signatureHeader) {
    return false;
  }

  // Reject anything older than 5 minutes — stops a captured/replayed request
  // from being reused later.
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return false;
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  // The secret Whop shows you is usually prefixed "whsec_" — strip that the
  // same way Svix-style verifiers do, since the actual signing key is
  // base64 after the prefix.
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  // webhook-signature can contain multiple space-separated "v1,<sig>"
  // values (for secret rotation) — matching any one of them is valid.
  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  return candidates.some((candidate) => {
    try {
      const a = Buffer.from(candidate, "base64");
      const b = Buffer.from(expected, "base64");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}
