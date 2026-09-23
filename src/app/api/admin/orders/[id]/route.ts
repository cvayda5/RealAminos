import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/types/database";
import { sendOrderShippedEmail } from "@/lib/email/sendOrderShipped";

interface Body {
  status?: OrderStatus;
  trackingNumber?: string;
}

// PATCH /api/admin/orders/[id] — update status/tracking. The
// "orders_update_admin" RLS policy means this UPDATE simply affects 0 rows
// (not an error, just silently a no-op) if the caller isn't an admin — so
// we double check first and return a real 403, which is more honest to the
// person calling this than a confusing empty success.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  const body = (await request.json()) as Body;
  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.trackingNumber !== undefined) updates.tracking_number = body.trackingNumber;

  // An unpaid Zelle order can only leave "Awaiting Payment" through
  // /api/admin/orders/[id]/mark-paid, which also decrements stock and
  // awards points as part of that same transition — those side effects
  // must never be skippable by just picking "Processing" from the normal
  // status dropdown. Also used below to only fire the "shipped" email on
  // the actual Processing/Awaiting → Shipped transition, not on every
  // subsequent Save (e.g. editing the tracking number after it's already
  // shipped).
  let previousStatus: OrderStatus | null = null;
  if (body.status) {
    const { data: current } = await supabase
      .from("orders")
      .select("status, payment_method")
      .eq("id", params.id)
      .single();

    previousStatus = (current?.status as OrderStatus | undefined) ?? null;

    if (current?.status === "Awaiting Payment" && current.payment_method === "zelle" && body.status !== "Awaiting Payment") {
      return NextResponse.json(
        { error: "Use \"Mark Paid & Fulfill\" to move a Zelle order out of Awaiting Payment." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire the "your order has shipped" email exactly once, on the transition
  // into Shipped — not on every Save while it's already Shipped (e.g. a
  // tracking-number correction after the fact).
  if (body.status === "Shipped" && previousStatus !== "Shipped" && data?.shipping_email) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, size, qty")
      .eq("order_id", params.id);

    await sendOrderShippedEmail({
      toEmail: data.shipping_email,
      orderNumber: data.order_number,
      items: (items ?? []).map((i) => ({ productName: i.product_name, size: i.size, qty: i.qty })),
      trackingNumber: data.tracking_number,
      shipping: {
        name: data.shipping_name ?? "",
        addressLine1: data.shipping_address_line1 ?? "",
        addressLine2: data.shipping_address_line2 ?? undefined,
        city: data.shipping_city ?? "",
        state: data.shipping_state ?? "",
        zip: data.shipping_zip ?? "",
      },
    });
  }

  return NextResponse.json({ order: data });
}

// DELETE /api/admin/orders/[id] — permanently removes an order. Meant for
// cleaning up a mistaken, duplicate, or test order (the ad-hoc, one-at-a-
// time version of 0021_clear_test_orders.sql's bulk cleanup), not for
// "cancelling" a real customer order after the fact.
//
// order_items cascades automatically (its FK is "on delete cascade" — see
// 0001_init.sql). point_transactions is NOT cascade — its FK is "on delete
// set null" (0007_points.sql), so left alone it would keep any points this
// order earned or redeemed counted in the customer's balance with no order
// left to trace them back to. Since deleting an order here means "this
// order shouldn't have existed," its point effects are deleted outright
// rather than orphaned. Runs on the service-role client because
// point_transactions has no admin-facing delete policy at all (same reason
// mark-paid uses it for its own point/stock writes).
//
// Deliberately does NOT touch product_variants.stock or the Shippo label
// (if one was bought) — reversing either of those automatically risks being
// wrong depending on whether the product actually already left the
// building, which only a human knows. If needed, that's a manual follow-up
// on /admin/inventory.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
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

  const { error: pointsError } = await admin.from("point_transactions").delete().eq("order_id", params.id);
  if (pointsError) {
    return NextResponse.json({ error: pointsError.message }, { status: 500 });
  }

  const { error } = await admin.from("orders").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
