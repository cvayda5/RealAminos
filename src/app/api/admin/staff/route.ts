import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  email: string;
  isAdmin: boolean;
}

// Both GET and POST here first verify the caller is an admin using their own
// session (RLS-backed, can't be faked), then do the actual read/write with
// the service-role admin client. Regular signed-in users never get a code
// path that can see or change someone else's is_admin flag — even the
// "profiles_select_admin" RLS policy only lets an admin SEE the list; the
// WRITE only ever happens here, server-side, after this same check.
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { user };
}

// GET /api/admin/staff — every account, most recently created first.
export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, is_admin, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: data });
}

// PATCH /api/admin/staff — promote or demote an existing account by email.
// This does NOT create accounts — the person has to have already signed up
// themselves (Sign Up page) so their password and 2FA stay theirs alone.
// This route just flips whether their existing account counts as staff.
export async function PATCH(request: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { user } = check;

  const body = (await request.json()) as Body;
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // Guard rail: don't let an admin remove their own access from this screen.
  // If the last admin locks themselves out, the only way back in is the SQL
  // command in README.md — better to just not allow the mistake here.
  if (!body.isAdmin && email === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You can't remove your own admin access here — have another admin do it." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ is_admin: body.isAdmin })
    .ilike("email", email)
    .select("id, email, is_admin")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "No account found with that email. They need to sign up first." },
      { status: 404 }
    );
  }

  return NextResponse.json({ profile: data });
}
