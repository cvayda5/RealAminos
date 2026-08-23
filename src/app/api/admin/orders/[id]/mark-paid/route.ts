import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderWithItems } from "@/types/database";
import { sendOrderConfirmationEmail } from "@/lib/email/sendOrderConfirmation";

// POST /api/admin/orders/[id]/mark-paid — the ONLY way a Zelle order moves
// out of "Awaiting Payment". Staff use this after manually checking the
// business's Zelle activity for a payment whose note contains this order's
// number, for the right amount (shown right on the order row).
//
// Runs on the service-role client for the actual mutations (same reasoning
// as the Whop webhook's finalizeOrder): decrement_variant_stock's grants
// are revoked from `authenticated`, and point_transactions has no
// customer/staff-facing write policy at all, so an admin's own session
// client can't perform either of those even though they pass is_admin().
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", params.id)
    .single<OrderWithItems>();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.payment_method !== "zelle" || order.status !== "Awaiting Payment") {
    return NextResponse.json(
      { error: "This order isn't an unpaid Zelle order — nothing to mark paid." },
      { status: 400 }
    );
  }

  // Stock only ever actually moves once a payment is truly confirmed — same
  // timing as the Whop webhook's finalizeOrder. order_items.product_id was
  // resolved and stored once at checkout time (0013_zelle_payments.sql), so
  // this can look the variant up directly instead of re-running the
  // productId/variantId quirk-handling resolveVariant.ts exists for.
  for (const item of order.order_items) {
    if (!item.product_id) {
      console.error("mark-paid: order_item missing product_id, can't decrement stock", order.id, item.id);
      continue;
    }
    const { data: variant } = await admin
      .from("product_variants")
      .select("id")
      .eq("product_id", item.product_id)
      .eq("size", item.size)
      .maybeSingle();

    if (!variant) {
      console.error("mark-paid: could not resolve variant to decrement stock", order.id, item.id);
      continue;
    }

    const { error: decrementError } = await admin.rpc("decrement_variant_stock", {
      p_variant_id: variant.id,
      p_qty: item.qty,
    });
    if (decrementError) {
      console.error("mark-paid: failed to decrement stock", order.id, item.id, decrementError.message);
    }
  }

  const pointsEarned = Math.floor(order.total ?? order.subtotal);
  if (pointsEarned > 0) {
    await admin.from("point_transactions").insert({
      user_id: order.user_id,
      points: pointsEarned,
      type: "earned",
      order_id: order.id,
      description: `Order ${order.order_number}`,
    });
  }

  // This is what makes a Zelle order take the same amount of time to
  // fulfill as any other order — it drops into the exact same
  // Processing → Shipped → Delivered timeline, no special "Zelle queue".
  const { error: updateError } = await admin
    .from("orders")
    .update({ status: "Processing" })
    .eq("id", order.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (order.shipping_email) {
    await sendOrderConfirmationEmail({
      toEmail: order.shipping_email,
      orderNumber: order.order_number,
      items: order.order_items.map((i) => ({
        productName: i.product_name,
        size: i.size,
        qty: i.qty,
        unitPrice: i.unit_price,
      })),
      subtotal: order.subtotal,
      discountCode: order.discount_code,
      discountPercent: order.discount_percent,
      total: order.total ?? order.subtotal,
      shippingFee: order.shipping_fee,
      shipping: {
        name: order.shipping_name ?? "",
        addressLine1: order.shipping_address_line1 ?? "",
        addressLine2: order.shipping_address_line2 ?? undefined,
        city: order.shipping_city ?? "",
        state: order.shipping_state ?? "",
        zip: order.shipping_zip ?? "",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
