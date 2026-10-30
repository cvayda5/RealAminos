import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/admin/orders/ad-conversions — a CSV of every PAID order that came
// from a Google Ads click, in the format Google Ads accepts under
// Goals > Conversions > Uploads. Orders without a saved ad click ID, and orders
// still awaiting payment, are left out.
//
// Safe to re-upload: each row carries the order number as the Order ID, and
// Google ignores a repeat of an Order ID it already has for that conversion.
//
// CONVERSION_NAME must match, letter for letter, the name of the "import"
// conversion action created in Google Ads (see the setup steps).
const CONVERSION_NAME = "Purchase Upload";
const TIME_ZONE = "America/Phoenix"; // Arizona — UTC-7 all year, no daylight saving
const UTC_OFFSET_HOURS = -7;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// "2026-10-30T20:05:11Z" → "2026-10-30 13:05:11" in Phoenix time.
function phoenixTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + UTC_OFFSET_HOURS * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: orders, error } = await supabase
    .from("orders")
    .select("order_number, created_at, status, total, subtotal, shipping_fee, zelle_discount_amount, ad_click_id")
    .not("ad_click_id", "is", null)
    .neq("status", "Awaiting Payment")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = [
    `Parameters:TimeZone=${TIME_ZONE}`,
    "Google Click ID,GBRAID,WBRAID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID",
  ];
  for (const o of orders ?? []) {
    const raw = String(o.ad_click_id ?? "");
    let gclid = "";
    let gbraid = "";
    let wbraid = "";
    if (raw.startsWith("gbraid:")) gbraid = raw.slice(7);
    else if (raw.startsWith("wbraid:")) wbraid = raw.slice(7);
    else gclid = raw.replace(/^gclid:/, "");
    if (!gclid && !gbraid && !wbraid) continue;

    const value =
      Math.round(((o.total ?? o.subtotal) + o.shipping_fee - (o.zelle_discount_amount ?? 0)) * 100) / 100;
    lines.push(
      [gclid, gbraid, wbraid, CONVERSION_NAME, phoenixTime(o.created_at), value.toFixed(2), "USD", o.order_number]
        .map(csvCell)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="google-ads-conversions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
