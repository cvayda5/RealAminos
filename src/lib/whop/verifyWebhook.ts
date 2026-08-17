import { createHmac, timingSafeEqual } from "crypto";

// Whop's own docs confirm the headers, the signed string, and the algorithm
// below, but are genuinely ambiguous about exactly how the "ws_..." secret
// gets turned into HMAC key bytes (their current SDK package also doesn't
// expose a verification helper to check against). Rather than guess wrong
// and end up with a webhook that silently never verifies — which would mean
// paid orders never get created — this tries every plausible way of
// deriving the key and accepts if any one of them produces a match. This
// doesn't weaken security: every candidate below is still a fixed function
// of your real secret, so none of it could be forged by someone without it.
function candidateKeys(secret: string): Buffer[] {
  const stripped = secret.replace(/^ws_/, "");
  const keys: Buffer[] = [];

  const tryAdd = (value: string, encoding: BufferEncoding) => {
    try {
      const buf = Buffer.from(value, encoding);
      if (buf.length > 0) keys.push(buf);
    } catch {
      // Invalid for this encoding (e.g. non-hex characters) — skip it.
    }
  };

  tryAdd(secret, "utf8"); // full "ws_..." string as a raw ASCII key
  tryAdd(stripped, "utf8"); // prefix stripped, as a raw ASCII key
  tryAdd(stripped, "hex"); // prefix stripped, interpreted as hex bytes
  tryAdd(stripped, "base64"); // prefix stripped, interpreted as base64 (Svix-style)
  tryAdd(secret, "base64"); // full string interpreted as base64

  return keys;
}

export function verifyWhopWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("WHOP_WEBHOOK_SECRET is not set — refusing to trust any webhook.");
    return false;
  }

  // TEMPORARY DIAGNOSTIC LOGGING — dump every header Whop actually sent, so
  // we can see the real shape of a request before assuming our parsing of it
  // is right. Remove once verification is confirmed working.
  console.log("[whop webhook] all headers:", JSON.stringify(Object.fromEntries(headers.entries())));

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");

  if (!id || !timestamp || !signatureHeader) {
    console.log("[whop webhook] missing one of the three signature headers", { id, timestamp, signatureHeader });
    return false;
  }

  // Reject anything older than 5 minutes — stops a captured/replayed request
  // from being reused later.
  const timestampSeconds = Number(timestamp);
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (!Number.isFinite(timestampSeconds) || ageSeconds > 300) {
    console.log("[whop webhook] timestamp rejected", { timestamp, ageSeconds });
    return false;
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;

  // webhook-signature can contain multiple space-separated "v1,<sig>"
  // values (for secret rotation) — matching any one of them is valid.
  const receivedSignatures = signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  const expectedDigests = candidateKeys(secret).map((key) =>
    createHmac("sha256", key).update(signedContent).digest("base64")
  );

  console.log("[whop webhook] diagnostic", {
    signedContent,
    receivedSignatures,
    expectedDigests,
    secretLength: secret.length,
    numCandidateKeys: candidateKeys(secret).length,
  });

  return receivedSignatures.some((received) => {
    let receivedBuf: Buffer;
    try {
      receivedBuf = Buffer.from(received, "base64");
    } catch {
      return false;
    }
    return expectedDigests.some((expected) => {
      const expectedBuf = Buffer.from(expected, "base64");
      return receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf);
    });
  });
}
