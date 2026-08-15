import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  pointsPerFreeVial?: number;
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

// PATCH /api/admin/points-settings — adjust how many points a free vial
// costs. This is the one number meant to change once real vial pricing is
// finalized, without needing a code deploy.
export async function PATCH(request: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const body = (await request.json()) as Body;
  const pointsPerFreeVial = Number(body.pointsPerFreeVial);

  if (!Number.isInteger(pointsPerFreeVial) || pointsPerFreeVial <= 0) {
    return NextResponse.json({ error: "Points per free vial must be a whole number greater than 0." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("point_settings")
    .update({ points_per_free_vial: pointsPerFreeVial, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("points_per_free_vial")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
