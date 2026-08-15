import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/admin/orders — every order, for staff. Deliberately uses the
// normal user-session client, not the service-role client: the
// "orders_select_own_or_admin" RLS policy already returns every row once
// public.is_admin() is true for the caller, so there's no need to bypass
// RLS here. If this user ISN'T an admin, Postgres itself just won't
// return other customers' rows — this route doesn't have to remember to check.
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

  // If the caller isn't actually an admin, RLS silently limited the query
  // to just their own orders above — that's correct behavior, not a bug.
  return NextResponse.json({ orders: data });
}
