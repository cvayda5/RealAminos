import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  code?: string;
}

// POST /api/discount-codes/validate — checks a single code typed in at
// checkout and returns its percent-off if it's real and active.
//
// Uses the service-role client on purpose: there's no customer-facing RLS
// policy that lets a signed-in shopper read discount_codes directly (see
// the comment in 0005_discount_codes.sql), because that would mean any
// customer could list every code that exists just by querying the table
// from the browser. This route only ever looks up the ONE code the caller
// typed in and returns whether it's valid — never the list.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Checkout already requires being signed in before this step is reachable
  // in the UI, so this just double-checks that server-side rather than
  // leaving the lookup open to anyone who finds the URL.
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const code = body.code?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Enter a discount code." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .select("code, percent_off")
    .ilike("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "That code is invalid or no longer active." }, { status: 404 });
  }

  return NextResponse.json({ code: data.code, percentOff: data.percent_off });
}
