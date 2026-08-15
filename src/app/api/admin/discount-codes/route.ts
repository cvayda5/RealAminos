import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  code: string;
  percentOff: number;
}

// Same pattern as /api/admin/staff: verify admin using the caller's own
// session (RLS-backed, can't be faked) before doing anything with the
// service-role client.
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

// GET /api/admin/discount-codes — every code, most recently created first.
export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .select("id, code, percent_off, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codes: data });
}

// POST /api/admin/discount-codes — create a new code. Codes are stored
// uppercased so "save20" and "SAVE20" are treated as the same code both
// here and when a customer types one in at checkout.
export async function POST(request: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const body = (await request.json()) as Body;
  const code = body.code?.trim().toUpperCase();
  const percentOff = Number(body.percentOff);

  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }
  if (!Number.isInteger(percentOff) || percentOff <= 0 || percentOff > 100) {
    return NextResponse.json({ error: "Percent off must be a whole number between 1 and 100." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .insert({ code, percent_off: percentOff })
    .select("id, code, percent_off, is_active, created_at")
    .single();

  if (error) {
    // Postgres' unique-violation code — surfaced as a friendly message
    // instead of a raw constraint error.
    if (error.code === "23505") {
      return NextResponse.json({ error: `A code named "${code}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discountCode: data }, { status: 201 });
}
