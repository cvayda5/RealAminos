import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  percentOff?: number;
  isActive?: boolean;
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

// PATCH /api/admin/discount-codes/[id] — adjust the percent off and/or
// flip a code active/inactive. Deactivating (rather than deleting) is the
// safer default for a code that's already been used on real orders, since
// those orders keep their own discount_percent/discount_code regardless —
// this only affects whether the code can be applied to *new* orders.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const body = (await request.json()) as Body;
  const updates: Record<string, unknown> = {};

  if (body.percentOff !== undefined) {
    const percentOff = Number(body.percentOff);
    if (!Number.isInteger(percentOff) || percentOff <= 0 || percentOff > 100) {
      return NextResponse.json({ error: "Percent off must be a whole number between 1 and 100." }, { status: 400 });
    }
    updates.percent_off = percentOff;
  }
  if (body.isActive !== undefined) {
    updates.is_active = body.isActive;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .update(updates)
    .eq("id", params.id)
    .select("id, code, percent_off, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discountCode: data });
}

// DELETE /api/admin/discount-codes/[id] — permanently remove a code.
// Existing orders that used it are unaffected (their discount_code/percent
// are stored directly on the order row, not looked up live), so this is
// safe to do at any time.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const admin = createAdminClient();
  const { error } = await admin.from("discount_codes").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
