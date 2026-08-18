import type { SupabaseClient } from "@supabase/supabase-js";

interface CartItemLike {
  productId: string;
  size: string;
  pointTransactionId?: string;
}

interface ResolvedVariant {
  id: string;
  stock: number;
  size: string;
  product_id: string;
}

// A normal paid cart line carries the *product's* id plus a chosen size, so
// the variant has to be looked up by (product_id, size). A reward line
// (redeemed with points) is different — RedeemProductGrid.tsx only ever has
// the *variant's* id on hand when it builds that cart line, and stores it in
// the same `productId` field for lack of a separate one. Both
// /api/checkout/whop (stock check before charging) and the Whop webhook
// (stock decrement after a real order is created) need to turn either shape
// back into the same real product_variants row, so that logic lives here
// once instead of twice.
export async function resolveVariant(
  admin: SupabaseClient,
  item: CartItemLike
): Promise<ResolvedVariant | null> {
  if (item.pointTransactionId) {
    const { data } = await admin
      .from("product_variants")
      .select("id, stock, size, product_id")
      .eq("id", item.productId)
      .maybeSingle<ResolvedVariant>();
    return data;
  }

  const { data } = await admin
    .from("product_variants")
    .select("id, stock, size, product_id")
    .eq("product_id", item.productId)
    .eq("size", item.size)
    .maybeSingle<ResolvedVariant>();
  return data;
}
