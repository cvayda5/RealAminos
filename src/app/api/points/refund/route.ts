import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PointTransaction } from "@/types/database";

interface Body {
  transactionId?: string;
}

// POST /api/points/refund — undo a redeem-to-cart reservation when the
// customer removes that reward from the cart before checking out. Only
// refundable while it's still just sitting in a cart: a reservation that
// already has an order_id was actually spent at checkout and can't be
// refunded here, and `voided` stops the exact same reservation from being
// refunded a second time (e.g. a double click).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const transactionId = body.transactionId;
  if (!transactionId) {
    return NextResponse.json({ error: "Missing transaction id." }, { status: 400 });
  }

  // "point_transactions_select_own_or_admin" lets the user's own session
  // read this row, and the .eq("user_id", ...) below on top of that RLS
  // means this can only ever match one of their own reservations.
  const { data: transaction, error: fetchError } = await supabase
    .from("point_transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single<PointTransaction>();

  if (fetchError || !transaction) {
    return NextResponse.json({ error: "That reservation could not be found." }, { status: 404 });
  }
  if (transaction.type !== "redeemed" || transaction.order_id || transaction.voided) {
    return NextResponse.json({ error: "That reward can no longer be refunded." }, { status: 400 });
  }

  const refundAmount = Math.abs(transaction.points);

  // Both writes need the service-role client — same reasoning as
  // redeem-to-cart, customers can read their own ledger but never write to
  // it directly.
  const admin = createAdminClient();

  const { error: voidError } = await admin
    .from("point_transactions")
    .update({ voided: true })
    .eq("id", transactionId);

  if (voidError) {
    return NextResponse.json({ error: voidError.message }, { status: 500 });
  }

  const { error: refundError } = await admin.from("point_transactions").insert({
    user_id: user.id,
    points: refundAmount,
    type: "earned",
    order_id: null,
    description: `Refunded — removed from cart (${transaction.description ?? "reward"})`,
  });

  if (refundError) {
    return NextResponse.json({ error: refundError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, refunded: refundAmount });
}
