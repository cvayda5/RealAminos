import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedDiscount {
  code: string | null;
  percent: number;
}

// Shared by both checkout routes (Whop and Zelle) so a customer-typed
// discount code is validated exactly one way, server-side — same reasoning
// as resolveVariant.ts living in one place instead of being copy-pasted
// with a chance to drift.
//
// This only ever resolves a real, customer-typed code from discount_codes.
// The site-wide sale (src/lib/promotions/siteSale.ts) is NOT handled here
// — it's baked directly into each line's unit price before this even runs
// (see resolveEffectivePrice(), used in both checkout routes), so a coupon
// code applies on top of the already-sale-adjusted subtotal, the same way
// a coupon would stack with a storewide sale at a normal retailer.
export async function resolveDiscount(
  admin: SupabaseClient,
  requestedCode: string | undefined
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

  return { code: found.code, percent: found.percent_off };
}
