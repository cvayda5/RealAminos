import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderWithItems } from "@/types/database";
import { finalizeZellePayment } from "@/lib/orders/finalizeZellePayment";

// POST /api/admin/orders/[id]/mark-paid — staff's manual override for a
// Zelle order, used after checking the business's Zelle activity for a
// payment whose note contains this order's number, for the right amount
// (shown right on the order row). No time limit, unlike the customer's own
// "I've Sent My Zelle Payment" button (src/app/api/orders/[id]/mark-paid) —
// this is what still lets staff finish an order whose 20-minute self-service
// window already lapsed, once they've actually confirmed the money arrived.
//
// The actual finalize step (stock, points, status, email) is shared with
// that customer-facing route — see finalizeZellePayment.ts — so the two
// can never behave differently depending on who clicked the button.
//
// Runs on the service-role client for the actual mutations (same reasoning
// as the Whop webhook's finalizeOrder): decrement_variants_stock_safe's
// grants are revoked from `authenticated`, and point_transactions has no
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

  const result = await finalizeZellePayment(admin, order, "staff");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
