import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PointTransaction, ShippingDetails } from "@/types/database";
import { sendOrderConfirmationEmail } from "@/lib/email/sendOrderConfirmation";

interface Body {
  productName?: string;
  size?: string;
  shipping?: ShippingDetails;
}

// POST /api/points/redeem — spend a full redemption's worth of points on
// one free vial. No partial redemption: this either grants a whole free
// vial and deducts the full points_per_free_vial cost, or it does nothing
// at all — there's no path here that spends fewer points than the full
// threshold. Not tied to any specific product's price yet (see
// 0007_points.sql) — the product/size the customer wants is just recorded
// on the order for staff to fulfill, the same way the manual test-order
// form works.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const productName = body.productName?.trim();
  const size = body.size?.trim();
  const shipping = body.shipping;

  if (!productName) {
    return NextResponse.json({ error: "Choose which product you'd like." }, { status: 400 });
  }

  const required: (keyof ShippingDetails)[] = ["name", "phone", "email", "addressLine1", "city", "state", "zip"];
  const missing = shipping ? required.filter((field) => !shipping[field]?.toString().trim()) : required;
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required shipping info: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // The threshold is public-readable (point_settings_select_all), so the
  // user's own session can read it directly.
  const { data: settings, error: settingsError } = await supabase
    .from("point_settings")
    .select("points_per_free_vial")
    .eq("id", 1)
    .single();

  if (settingsError || !settings) {
    return NextResponse.json({ error: "Could not load the current points threshold." }, { status: 500 });
  }
  const cost = settings.points_per_free_vial;

  // Re-derive the balance from the ledger itself, server-side, right
  // before spending it — never trust a balance the client might send.
  const { data: transactions, error: txError } = await supabase
    .from("point_transactions")
    .select("points")
    .eq("user_id", user.id)
    .returns<Pick<PointTransaction, "points">[]>();

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }
  const balance = (transactions ?? []).reduce((sum, t) => sum + t.points, 0);

  if (balance < cost) {
    return NextResponse.json(
      { error: `You need ${cost} points to redeem a free vial — you have ${balance}.` },
      { status: 400 }
    );
  }

  // The order itself is created with the user's own session, same as
  // /api/orders — "orders_insert_own" RLS already allows this. It's
  // recorded as a real order (subtotal/total of $0, one free item) so it
  // shows up in the customer's order history and staff fulfillment queue
  // exactly like a paid order does, just with points_redeemed set.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      subtotal: 0,
      total: 0,
      discount_code: null,
      discount_percent: 0,
      points_redeemed: cost,
      shipping_name: shipping!.name,
      shipping_phone: shipping!.phone,
      shipping_email: shipping!.email,
      shipping_address_line1: shipping!.addressLine1,
      shipping_address_line2: shipping!.addressLine2 || null,
      shipping_city: shipping!.city,
      shipping_state: shipping!.state,
      shipping_zip: shipping!.zip,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Could not create the order." }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_name: productName,
    size: size || "N/A",
    qty: 1,
    unit_price: 0,
  });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Deducting points requires the service-role client — there's no
  // customer-facing insert policy on point_transactions on purpose (see
  // 0007_points.sql), so a regular session can read the ledger but never
  // write to it directly.
  const admin = createAdminClient();
  const { error: deductError } = await admin.from("point_transactions").insert({
    user_id: user.id,
    points: -cost,
    type: "redeemed",
    order_id: order.id,
    description: `Redeemed for a free vial (Order ${order.order_number})`,
  });

  if (deductError) {
    return NextResponse.json({ error: deductError.message }, { status: 500 });
  }

  await sendOrderConfirmationEmail({
    toEmail: shipping!.email,
    orderNumber: order.order_number,
    items: [{ productName, size: size || "N/A", qty: 1, unitPrice: 0 }],
    subtotal: 0,
    total: 0,
    shipping: shipping!,
  });

  return NextResponse.json({ order }, { status: 201 });
}
