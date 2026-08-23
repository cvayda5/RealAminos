import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

interface Body {
  status?: OrderStatus;
  trackingNumber?: string;
}

// PATCH /api/admin/orders/[id] — update status/tracking. The
// "orders_update_admin" RLS policy means this UPDATE simply affects 0 rows
// (not an error, just silently a no-op) if the caller isn't an admin — so
// we double check first and return a real 403, which is more honest to the
// person calling this than a confusing empty success.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json()) as Body;
  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.trackingNumber !== undefined) updates.tracking_number = body.trackingNumber;

  // An unpaid Zelle order can only leave "Awaiting Payment" through
  // /api/admin/orders/[id]/mark-paid, which also decrements stock and
  // awards points as part of that same transition — those side effects
  // must never be skippable by just picking "Processing" from the normal
  // status dropdown.
  if (body.status) {
    const { data: current } = await supabase
      .from("orders")
      .select("status, payment_method")
      .eq("id", params.id)
      .single();

    if (current?.status === "Awaiting Payment" && current.payment_method === "zelle" && body.status !== "Awaiting Payment") {
      return NextResponse.json(
        { error: "Use \"Mark Paid & Fulfill\" to move a Zelle order out of Awaiting Payment." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ order: data });
}
