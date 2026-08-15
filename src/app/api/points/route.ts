import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PointTransaction } from "@/types/database";

// GET /api/points — the signed-in user's own points balance and history.
// Uses the user's own session (not the service role), since
// "point_transactions_select_own_or_admin" already lets them read their
// own rows — same reasoning as /api/orders' GET. Redemption cost isn't a
// single number anymore (see 0008_points_redeem_to_cart.sql) — each
// product's cost is looked up per-vial on the /points page instead.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: transactions, error } = await supabase
    .from("point_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<PointTransaction[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const balance = (transactions ?? []).reduce((sum, t) => sum + t.points, 0);

  return NextResponse.json({ balance, transactions: transactions ?? [] });
}
