import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { purchaseLabel } from "@/lib/shipping/shippo";
import { sendOrderShippedEmail } from "@/lib/email/sendOrderShipped";
import type { Order, OrderStatus } from "@/types/database";

interface Body {
  rateObjectId?: string;
  carrier?: string;
  serviceLevelName?: string;
  weightOz?: number;
}

// POST /api/admin/orders/[id]/buy-label — actually spends money: buys the
// Shippo label for a rate the staff member picked (from shipping-rates'
// response), then saves the tracking number + label straight onto the
// order and flips it to Shipped — reusing the exact same "send shipped
// email" logic PATCH .../orders/[id] uses on that same transition, so
// buying a label here behaves identically to typing in a tracking number
// there by hand, just without the manual step.
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

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.rateObjectId || !body.carrier || !body.serviceLevelName) {
    return NextResponse.json({ error: "Missing rate selection — get rates again and pick one." }, { status: 400 });
  }

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("status, order_number, shipping_email, shipping_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_zip")
    .eq("id", params.id)
    .single<Pick<Order, "status" | "order_number" | "shipping_email" | "shipping_name" | "shipping_address_line1" | "shipping_address_line2" | "shipping_city" | "shipping_state" | "shipping_zip">>();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const previousStatus = order.status;

  let label;
  try {
    label = await purchaseLabel(body.rateObjectId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't buy this label from Shippo." },
      { status: 502 }
    );
  }

  // A Delivered order shouldn't get bumped backward to Shipped just because
  // staff bought a (presumably replacement) label after the fact — anything
  // else (Awaiting Payment, Processing, already Shipped) moves to Shipped.
  const nextStatus: OrderStatus = previousStatus === "Delivered" ? "Delivered" : "Shipped";

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
      tracking_number: label.trackingNumber,
      shipping_carrier: body.carrier,
      shipping_service: body.serviceLevelName,
      label_url: label.labelUrl,
      label_purchased_at: new Date().toISOString(),
      package_weight_oz: body.weightOz ?? null,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (updateError) {
    // The label is already bought and real money's been spent at this point
    // — surface the label URL anyway so it isn't silently lost even though
    // saving it to the order row failed.
    return NextResponse.json(
      {
        error: `Label purchased but saving it to the order failed: ${updateError.message}`,
        labelUrl: label.labelUrl,
        trackingNumber: label.trackingNumber,
      },
      { status: 500 }
    );
  }

  if (nextStatus === "Shipped" && previousStatus !== "Shipped" && order.shipping_email) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, size, qty")
      .eq("order_id", params.id);

    await sendOrderShippedEmail({
      toEmail: order.shipping_email,
      orderNumber: order.order_number,
      items: (items ?? []).map((i) => ({ productName: i.product_name, size: i.size, qty: i.qty })),
      trackingNumber: label.trackingNumber,
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

  return NextResponse.json({ order: updated, labelUrl: label.labelUrl });
}
