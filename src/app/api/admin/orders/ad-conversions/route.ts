import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AD_ORDER_COLUMNS, buildAdConversionsCsv } from "@/lib/ads/conversionCsv";

// GET /api/admin/orders/ad-conversions — the "Ad Conversions CSV" button on the
// admin Orders page. Every PAID order that came from a Google Ads click, in the
// format Google Ads accepts under Goals > Conversions > Uploads. Orders without
// a saved ad click ID, and orders still awaiting payment, are left out.
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
    .select(AD_ORDER_COLUMNS)
    .not("ad_click_id", "is", null)
    .neq("status", "Awaiting Payment")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(buildAdConversionsCsv(orders ?? []), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="google-ads-conversions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
