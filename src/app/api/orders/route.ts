import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NewOrderPayload } from "@/types/database";

// POST /api/orders — creates an order + its line items for the signed-in
// user. Uses the user's own session (not the service role), so the
// "orders_insert_own" RLS policy is what actually stops one user from
// creating an order under someone else's account — this route can't bypass
// that even with a bug, because it never gets elevated privileges.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json()) as NewOrderPayload;
  if (!body.items?.length) {
    return NextResponse.json({ error: "Order must include at least one item." }, { status: 400 });
  }

  const subtotal = body.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ user_id: user.id, subtotal })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Could not create order." }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    body.items.map((i) => ({
      order_id: order.id,
      product_name: i.productName,
      size: i.size,
      qty: i.qty,
      unit_price: i.unitPrice,
    }))
  );

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ order }, { status: 201 });
}

// GET /api/orders — the signed-in user's own orders (JSON). Handy for
// hooking a real frontend cart/checkout up to this later instead of using
// the Server Component page directly.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data });
}
