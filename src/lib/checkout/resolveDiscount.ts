import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedDiscount {
  code: string | null;
  percent: number;
}

// Who is placing the order — used to stop an affiliate from using their own
// code on their own purchases. Every field is optional; whatever is known at
// the call site gets compared.
export interface DiscountBuyer {
  userEmail?: string | null; // the signed-in account's email
  shippingEmail?: string | null;
  shippingPhone?: string | null;
}

export const OWN_CODE_MESSAGE =
  "You can't use your own affiliate code on your own order — remove the code to continue.";

// Digits only, US-style: "+1 (623) 694-2769" and "6236942769" compare equal.
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

interface AffiliateIdentity {
  email: string | null;
  phone: string | null;
  zelle_info: string | null;
}

// True when the buyer is the affiliate who owns the code. Compares the
// affiliate's application (email, phone, and Zelle contact — which can be
// either an email or a phone) against the buyer's account email, shipping
// email and shipping phone. Pure function so it can be tested on its own.
export function buyerIsAffiliate(affiliate: AffiliateIdentity, buyer: DiscountBuyer): boolean {
  const buyerEmails = [buyer.userEmail, buyer.shippingEmail].map(normalizeEmail).filter(Boolean);
  const buyerPhone = normalizePhone(buyer.shippingPhone);

  const affiliateEmails = [affiliate.email, affiliate.zelle_info]
    .map(normalizeEmail)
    .filter((v) => v.includes("@"));
  const affiliatePhones = [affiliate.phone, affiliate.zelle_info]
    .filter((v): v is string => !!v && !v.includes("@"))
    .map(normalizePhone)
    .filter((v) => v.length >= 10);

  if (buyerEmails.some((e) => affiliateEmails.includes(e))) return true;
  if (buyerPhone.length >= 10 && affiliatePhones.includes(buyerPhone)) return true;
  return false;
}

// Throws OWN_CODE_MESSAGE if `code` was requested by an affiliate who is the
// buyer. Codes that don't belong to any affiliate application (e.g. staff-made
// promo codes) are never affected.
export async function assertNotOwnAffiliateCode(
  admin: SupabaseClient,
  code: string,
  buyer: DiscountBuyer
): Promise<void> {
  const { data: affiliates } = await admin
    .from("affiliate_signups")
    .select("email, phone, zelle_info")
    .ilike("preferred_code", code);

  if ((affiliates ?? []).some((a) => buyerIsAffiliate(a as AffiliateIdentity, buyer))) {
    throw new Error(OWN_CODE_MESSAGE);
  }
}

// Shared by all checkout routes so a customer-typed discount code is
// validated exactly one way, server-side — same reasoning as
// resolveVariant.ts living in one place instead of being copy-pasted with a
// chance to drift.
//
// This only ever resolves a real, customer-typed code from discount_codes.
// Any struck-through "was" pricing (src/lib/promotions/siteSale.ts,
// compare_at_price) is purely a display thing and never affects the
// subtotal a coupon code applies on top of here — the real charged price is
// just each variant's stored `price`.
export async function resolveDiscount(
  admin: SupabaseClient,
  requestedCode: string | undefined,
  buyer?: DiscountBuyer
): Promise<ResolvedDiscount> {
  const trimmed = requestedCode?.trim();
  if (!trimmed) {
    return { code: null, percent: 0 };
  }

  const { data: found } = await admin
    .from("discount_codes")
    .select("code, percent_off")
    .ilike("code", trimmed)
    .eq("is_active", true)
    .maybeSingle();

  if (!found) {
    throw new Error("That discount code is no longer valid — remove it and try again.");
  }

  if (buyer) await assertNotOwnAffiliateCode(admin, found.code, buyer);

  return { code: found.code, percent: found.percent_off };
}
