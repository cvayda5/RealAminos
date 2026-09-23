import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShippingRates } from "@/lib/shipping/shippo";
import type { Order } from "@/types/database";

interface Body {
  weightOz?: number;
}

// POST /api/admin/orders/[id]/shipping-rates — quotes Shippo rates for this
// order's actual saved shipping address, given a weight staff types in.
// Doesn't buy anything yet — see buy-label/route.ts for that step, once
// staff has picked one of the rates this returns.
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
  const weightOz = Number(body.weightOz);
  if (!weightOz || weightOz <= 0) {
    return NextResponse.json({ error: "Enter a package weight in ounces first." }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .single<Order>();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (!order.shipping_name || !order.shipping_address_line1 || !order.shipping_city || !order.shipping_state || !order.shipping_zip) {
    return NextResponse.json(
      { error: "This order is missing shipping address fields (likely a pre-migration order) — can't quote rates." },
      { status: 400 }
    );
  }

  try {
    const rates = await getShippingRates(
      {
        name: order.shipping_name,
        street1: order.shipping_address_line1,
        street2: order.shipping_address_line2,
        city: order.shipping_city,
        state: order.shipping_state,
        zip: order.shipping_zip,
        phone: order.shipping_phone,
        email: order.shipping_email,
      },
      weightOz
    );
    return NextResponse.json({ rates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't get rates from Shippo." },
      { status: 502 }
    );
  }
}
