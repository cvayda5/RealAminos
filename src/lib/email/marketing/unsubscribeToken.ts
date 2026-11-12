// Signed unsubscribe links for marketing email. The link carries the address
// and an HMAC of it, so it can't be forged to unsubscribe somebody else and
// needs no per-contact database row. Signed with CRON_SECRET (already set in
// Vercel for the scheduled jobs).
import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.CRON_SECRET;
  if (!s) throw new Error("CRON_SECRET is not set");
  return s;
}

function sign(email: string): string {
  return createHmac("sha256", secret()).update(email).digest("base64url").slice(0, 32);
}

export function buildUnsubscribeUrl(email: string): string {
  const e = email.trim().toLowerCase();
  const params = new URLSearchParams({ e: Buffer.from(e).toString("base64url"), s: sign(e) });
  return `https://shoprealaminos.com/api/marketing/unsubscribe?${params.toString()}`;
}

/** Returns the email address if the link is genuine, otherwise null. */
export function verifyUnsubscribe(e: string, s: string): string | null {
  try {
    const email = Buffer.from(e, "base64url").toString("utf8").trim().toLowerCase();
    if (!email || email.length > 254) return null;
    const given = Buffer.from(s);
    const expected = Buffer.from(sign(email));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return email;
  } catch {
    return null;
  }
}
