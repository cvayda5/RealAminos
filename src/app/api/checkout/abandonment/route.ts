import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVariant } from "@/lib/inventory/resolveVariant";
import { bulkUnitPrice } from "@/lib/promotions/bulkPricing";
import type { NewOrderPayload } from "@/types/database";

// POST /api/checkout/abandonment — called by the cart drawer the moment a
// signed-in customer submits their shipping info (before choosing how to
// pay). It records what's in their cart so the reminder emails
// (/api/cron/abandoned-checkouts) can follow up if they never finish.
//
// Nothing the browser sends is trusted for pricing: each line is re-priced
// from the real database price + bulk tier, and the emails always go to the
// signed-in ACCOUNT's own email, never an address typed into the form — so
// this can't be used to send mail to anyone else. Failures are harmless: the
// client ignores the response.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<NewOrderPayload>;
  const shipping = body.shipping;
  const paidLines = (body.items ?? [])
    .filter((i) => i && !i.pointTransactionId && Number.isFinite(i.qty) && i.qty > 0)
    .slice(0, 30);

  if (paidLines.length === 0 || !shipping?.name?.trim() || !shipping.addressLine1?.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createAdminClient();

  const items: { productName: string; size: string; qty: number; unitPrice: number }[] = [];
  for (const line of paidLines) {
    const variant = await resolveVariant(admin, line);
    if (!variant) continue;
    items.push({
      productName: String(line.productName ?? "").slice(0, 120),
      size: String(line.size ?? "").slice(0, 40),
      qty: Math.min(Math.floor(line.qty), 999),
      unitPrice: bulkUnitPrice(variant.price, line.qty),
    });
  }
  if (items.length === 0) return NextResponse.json({ ok: false }, { status: 400 });

  const subtotal = Math.round(items.reduce((s, i) => s + i.unitPrice * i.qty, 0) * 100) / 100;
  const firstName = shipping.name.trim().split(/\s+/)[0].slice(0, 40);
  const nowIso = new Date().toISOString();

  const { data: existing } = await admin
    .from("abandoned_checkouts")
    .select("id, emails_sent, completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("abandoned_checkouts").insert({
      user_id: user.id,
      email: user.email,
      first_name: firstName,
      items,
      subtotal,
      captured_at: nowIso,
      last_activity_at: nowIso,
    });
    if (error) console.error("abandonment: insert failed", error.message);
  } else {
    // A finished or already-fully-emailed cycle starts over; one still in
    // progress just has its activity time (and cart) refreshed.
    const startOver = !!existing.completed_at || existing.emails_sent >= 3;
    const { error } = await admin
      .from("abandoned_checkouts")
      .update({
        email: user.email,
        first_name: firstName,
        items,
        subtotal,
        last_activity_at: nowIso,
        ...(startOver
          ? { emails_sent: 0, last_email_at: null, completed_at: null, captured_at: nowIso }
          : {}),
      })
      .eq("id", existing.id);
    if (error) console.error("abandonment: update failed", error.message);
  }

  return NextResponse.json({ ok: true });
}
