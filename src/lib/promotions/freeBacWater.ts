// "Free BAC Water with every $100" promotion.
//
// For every full $100 a customer spends on products (after bulk pricing and
// any discount code, before shipping, and not counting the free item itself),
// they can add one free bacteriostatic water to the order at checkout.
//
// This file is the one place the rule lives. The cart drawer imports
// freeBacEntitlement() to show the customer what they've unlocked, and all
// three checkout routes (zelle / square / bitcoin) call
// extractFreeBacRequest() + buildFreeBacItem() so the freebie is ENFORCED on
// the server: the browser can only ask for N free units — the server decides
// how many are really earned, which product/size is given, and that it costs
// $0. Nothing about the free line (name, price, product) is trusted from the
// request body.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewOrderPayload } from "@/types/database";

/** Dollars of spend needed to earn each free BAC Water. */
export const FREE_BAC_THRESHOLD = 100;

/** How many free BAC Waters a given qualifying total (in dollars) has earned. */
export function freeBacEntitlement(qualifyingTotal: number): number {
  if (!Number.isFinite(qualifyingTotal) || qualifyingTotal <= 0) return 0;
  // Work in cents so a total like 99.999999 never rounds up into a free item.
  return Math.floor(Math.round(qualifyingTotal * 100) / (FREE_BAC_THRESHOLD * 100));
}

export interface FreeBacProduct {
  productId: string;
  productName: string;
  size: string;
  stock: number;
}

// Finds the product that's given away. By default it's the first in-stock
// variant of an active product whose name contains "bac water" or
// "bacteriostatic". Set FREE_BAC_VARIANT_ID in the environment (Vercel) to a
// specific product_variants.id to pin the exact product + size instead.
export async function findFreeBacProduct(admin: SupabaseClient): Promise<FreeBacProduct | null> {
  const pinnedVariantId = process.env.FREE_BAC_VARIANT_ID?.trim();

  if (pinnedVariantId) {
    const { data: v } = await admin
      .from("product_variants")
      .select("id, product_id, size, stock")
      .eq("id", pinnedVariantId)
      .maybeSingle<{ id: string; product_id: string; size: string; stock: number }>();
    if (!v || v.stock <= 0) return null;
    const { data: p } = await admin
      .from("products")
      .select("id, name, is_active")
      .eq("id", v.product_id)
      .maybeSingle<{ id: string; name: string; is_active: boolean }>();
    if (!p || !p.is_active) return null;
    return { productId: p.id, productName: p.name, size: v.size, stock: v.stock };
  }

  const { data: products } = await admin
    .from("products")
    .select("id, name")
    .eq("is_active", true)
    .or("name.ilike.%bac water%,name.ilike.%bacteriostatic%")
    .returns<{ id: string; name: string }[]>();
  if (!products || products.length === 0) return null;

  const { data: variants } = await admin
    .from("product_variants")
    .select("product_id, size, stock, price, sort_order")
    .in(
      "product_id",
      products.map((p) => p.id)
    )
    .gt("stock", 0)
    .order("sort_order", { ascending: true })
    .order("price", { ascending: true })
    .returns<{ product_id: string; size: string; stock: number; price: number; sort_order: number }[]>();
  const v = variants?.[0];
  if (!v) return null;
  const p = products.find((x) => x.id === v.product_id);
  if (!p) return null;
  return { productId: p.id, productName: p.name, size: v.size, stock: v.stock };
}

/**
 * Pulls the free-BAC-water request out of a checkout payload. Removes any
 * flagged lines from body.items (so the rest of the route only ever sees
 * real, paid / points lines) and returns how many free units were asked for.
 */
export function extractFreeBacRequest(body: NewOrderPayload): number {
  const all = Array.isArray(body.items) ? body.items : [];
  let requested = 0;
  const kept: typeof all = [];
  for (const line of all) {
    if (line && line.freeBacWater) {
      const q = Math.floor(Number(line.qty));
      if (Number.isFinite(q) && q > 0) requested += q;
    } else {
      kept.push(line);
    }
  }
  body.items = kept;
  return requested;
}

export interface FreeBacOrderItem {
  productName: string;
  size: string;
  qty: number;
  unitPrice: 0;
  productId: string;
}

/**
 * Decides what free BAC Water (if any) goes on the order. qualifyingTotal is
 * the order's product total after bulk pricing and discount code, before
 * shipping. paidLines are the paid cart lines with their REAL resolved
 * product ids, used so the free units never oversell stock the customer is
 * already buying.
 *
 * Quietly gives less (or nothing) rather than failing the checkout if the
 * customer asked for more than they earned or stock ran short.
 */
export async function buildFreeBacItem(
  admin: SupabaseClient,
  opts: {
    requestedQty: number;
    qualifyingTotal: number;
    paidLines: { productId: string; size: string; qty: number }[];
  }
): Promise<FreeBacOrderItem | null> {
  if (opts.requestedQty <= 0) return null;
  const earned = freeBacEntitlement(opts.qualifyingTotal);
  if (earned <= 0) return null;

  const product = await findFreeBacProduct(admin);
  if (!product) return null;

  const alreadyBuying = opts.paidLines
    .filter((l) => l.productId === product.productId && l.size === product.size)
    .reduce((sum, l) => sum + l.qty, 0);
  const available = product.stock - alreadyBuying;

  const qty = Math.min(opts.requestedQty, earned, available);
  if (qty <= 0) return null;

  return {
    productName: `${product.productName} (FREE - $${FREE_BAC_THRESHOLD} reward)`,
    size: product.size,
    qty,
    unitPrice: 0,
    productId: product.productId,
  };
}
