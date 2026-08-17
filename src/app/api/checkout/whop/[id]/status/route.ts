import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/checkout/whop/[id]/status — polled by /checkout/complete while it
// waits for the Whop webhook to land. Runs under the customer's own session,
// so pending_checkouts_select_own_or_admin (see 0010_whop_checkout.sql) is
// what actually stops one user from polling another user's checkout status —
// this route can't bypass that even with a bug.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pending_checkouts")
    .select("status")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ status: data.status });
}
