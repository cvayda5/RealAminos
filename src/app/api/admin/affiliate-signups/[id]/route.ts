import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  contacted?: boolean;
}

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

  return {};
}

// PATCH /api/admin/affiliate-signups/[id] — toggle whether staff have
// reached out to this applicant and gotten their code set up yet.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const body = (await request.json()) as Body;
  if (body.contacted === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_signups")
    .update({ contacted: body.contacted })
    .eq("id", params.id)
    .select("id, contacted")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signup: data });
}
