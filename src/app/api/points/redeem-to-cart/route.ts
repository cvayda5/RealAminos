import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PointTransaction } from "@/types/database";

interface Body {
  variantId?: string;
}

interface VariantRow {
  id: string;
  size: string;
  price: number;
  product_id: string;
  products: { name: string; is_active: boolean } | null;
}

// POST /api/points/redeem-to-cart — reserve the points for one free vial
// and hand back a cart line for it. This does NOT place an order — it just
// deducts the points right away (so the same points can't be redeemed
// twice while sitting in the cart) and returns a point_transactions id the
// browser attaches to the cart line. Removing that line later refunds this
// exact reservation (see /api/points/refund); checking out with it links
// the reservation to the finished order (see /api/orders) instead.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const variantId = body.variantId;
  if (!variantId) {
    return NextResponse.json({ error: "Choose a product to redeem." }, { status: 400 });
  }

  // Public read (product_variants_select_all / products_select_all), so
  // the user's own session can look this up directly — same as browsing
  // the shop.
  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id, size, price, product_id, products(name, is_active)")
    .eq("id", variantId)
    .single<VariantRow>();

  if (variantError || !variant || !variant.products?.is_active) {
    return NextResponse.json({ error: "That product is no longer available." }, { status: 404 });
  }

  // Redeeming costs 10 points per dollar of the vial's current price — a
  // different rate than the 1-point-per-dollar customers earn (see
  // /api/orders), by design. Rounds to the nearest whole point since
  // prices carry cents and points don't; this recalculates from the live
  // price every time, so it moves automatically whenever a variant's price
  // changes — no separate "points cost" field to keep in sync.
  const POINTS_PER_DOLLAR_TO_REDEEM = 10;
  const pointsCost = Math.max(1, Math.round(variant.price * POINTS_PER_DOLLAR_TO_REDEEM));

  const { data: transactions, error: txError } = await supabase
    .from("point_transactions")
    .select("points")
    .eq("user_id", user.id)
    .returns<Pick<PointTransaction, "points">[]>();

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }
  const balance = (transactions ?? []).reduce((sum, t) => sum + t.points, 0);

  if (balance < pointsCost) {
    return NextResponse.json(
      { error: `You need ${pointsCost} points for this vial — you have ${balance}.` },
      { status: 400 }
    );
  }

  // Deducting points requires the service-role client — there's no
  // customer-facing insert policy on point_transactions on purpose (see
  // 0007_points.sql), so a regular session can read the ledger but never
  // write to it directly.
  const admin = createAdminClient();
  const { data: reservation, error: insertError } = await admin
    .from("point_transactions")
    .insert({
      user_id: user.id,
      points: -pointsCost,
      type: "redeemed",
      order_id: null,
      description: `Reserved: ${variant.products.name} (${variant.size})`,
    })
    .select("id")
    .single();

  if (insertError || !reservation) {
    return NextResponse.json({ error: insertError?.message ?? "Could not reserve points." }, { status: 500 });
  }

  return NextResponse.json(
    {
      transactionId: reservation.id,
      pointsCost,
      productName: variant.products.name,
      size: variant.size,
    },
    { status: 201 }
  );
}
