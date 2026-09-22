import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderWithItems } from "@/types/database";
import { finalizeZellePayment, isZellePaymentWindowExpired } from "@/lib/orders/finalizeZellePayment";

// POST /api/orders/[id]/mark-paid — the CUSTOMER's own "I've Sent My Zelle
// Payment" button (see ZellePaymentStatus.tsx, used from both CartDrawer's
// checkout panel and the My Orders page). Previously, stock only ever
// moved once staff got around to manually confirming a Zelle payment and
// clicking "Mark Paid & Fulfill" — sometimes well after the fact, which
// meant a low-stock item could quietly get "sold" to more customers via
// Zelle than were actually in stock, since nothing reserved or decremented
// anything until that manual click. This lets the customer trigger the
// same finalize step themselves the moment they've actually sent the
// money, so stock comes off the shelf right away instead of staying
// "available" while an unpaid Zelle order sits around.
//
// Gated to a 20-minute window from order creation (see
// isZellePaymentWindowExpired in finalizeZellePayment.ts) so this can't be
// used to reserve stock indefinitely by creating an order and never
// paying. After 20 minutes, only staff can finish it via
// /api/admin/orders/[id]/mark-paid (no time limit there), once they've
// actually confirmed the payment against real Zelle activity — this
// self-service button does NOT replace that check, it just changes when
// stock reacts; staff still verify the order number/amount before shipping
// (see the zelle_marked_paid_by reminder shown on /admin/orders).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", params.id)
    .single<OrderWithItems>();

  // Ownership isn't enforced by RLS here (this reads through the
  // service-role client, same as the admin route, since finalizing needs
  // privileged writes right after) — so it's checked by hand instead.
  // Returning the same "not found" for a missing order and someone else's
  // order avoids confirming/denying that a given order id exists at all.
  if (fetchError || !order || order.user_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.payment_method !== "zelle" || order.status !== "Awaiting Payment") {
    return NextResponse.json(
      { error: "This order isn't waiting on a Zelle payment." },
      { status: 400 }
    );
  }

  if (isZellePaymentWindowExpired(order)) {
    return NextResponse.json(
      {
        error:
          "The 20-minute window to confirm this Zelle payment has passed. If you already sent it, email info@shoprealaminos.com with your order number and we'll sort it out.",
      },
      { status: 400 }
    );
  }

  const result = await finalizeZellePayment(admin, order, "customer");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
