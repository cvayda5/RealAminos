import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_BAC_THRESHOLD, findFreeBacProduct } from "@/lib/promotions/freeBacWater";

export const dynamic = "force-dynamic";

// GET /api/promotions/free-bac — tells the cart which product is the free
// "every $100" BAC Water (and how many are in stock) so it can offer it.
// Public, read-only. Checkout never trusts any of this: the checkout routes
// look the product up again themselves.
export async function GET() {
  try {
    const admin = createAdminClient();
    const product = await findFreeBacProduct(admin);
    return NextResponse.json({ threshold: FREE_BAC_THRESHOLD, product });
  } catch {
    return NextResponse.json({ threshold: FREE_BAC_THRESHOLD, product: null });
  }
}
