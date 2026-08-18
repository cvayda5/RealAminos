import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  stock?: number;
  price?: number;
}

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return {};
}

// PATCH /api/admin/inventory/[variantId] — set how many units of one
// product+size are on hand, and/or its price. This is the only place stock
// numbers are supposed to change by hand — every other decrease happens
// automatically via decrement_variant_stock() when a real order finalizes
// (see the Whop webhook). Setting stock to 0 is exactly what puts a size
// into "Out of Stock — Coming Soon" on the storefront; there's no separate
// visibility flag to also flip.
export async function PATCH(request: Request, { params }: { params: { variantId: string } }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const body = (await request.json()) as Body;
  const updates: Record<string, unknown> = {};

  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return NextResponse.json({ error: "Stock must be a whole number of 0 or more." }, { status: 400 });
    }
    updates.stock = stock;
  }

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Price must be a number of 0 or more." }, { status: 400 });
    }
    updates.price = Math.round(price * 100) / 100;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("product_variants")
    .update(updates)
    .eq("id", params.variantId)
    .select("id, size, price, stock, sort_order, product_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ variant: data });
}
