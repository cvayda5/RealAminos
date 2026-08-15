// Supabase redirects here after ANY email link is clicked — signup
// confirmation, and now also password reset. Both work the same way under
// the hood (a one-time code gets exchanged for a real session), they just
// need to land somewhere different afterward: signup confirmation should
// drop someone into their account, but a password reset needs to land on
// the "choose a new password" screen instead. The "next" query param (set
// when each flow calls its own Supabase function) is what tells this route
// which one it is.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/account/orders";

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
