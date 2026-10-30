import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AD_ORDER_COLUMNS, buildAdConversionsCsv } from "@/lib/ads/conversionCsv";

// GET /api/ad-conversions/feed — the same CSV as the admin button, but served
// to Google Ads' scheduled upload instead of a signed-in person.
//
// Protected with HTTP Basic auth: username "googleads", password = the
// AD_EXPORT_PASSWORD environment variable (set it in Vercel). Without that
// variable the feed is switched off entirely. It only ever returns paid orders
// from the last 90 days that carry a Google Ads click ID — order number, time,
// value and the click ID, no names, emails or addresses.
export const dynamic = "force-dynamic";

const USERNAME = "googleads";

function sha(s: string) {
  return createHash("sha256").update(s).digest();
}

function authorized(request: Request, password: string) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  // Compare hashes so the comparison is constant-time and equal-length.
  const okUser = timingSafeEqual(sha(user), sha(USERNAME));
  const okPass = timingSafeEqual(sha(pass), sha(password));
  return okUser && okPass;
}

export async function GET(request: Request) {
  const password = process.env.AD_EXPORT_PASSWORD;
  if (!password || password.length < 12) {
    return NextResponse.json({ error: "Feed is not enabled." }, { status: 503 });
  }
  if (!authorized(request, password)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="ad-conversions", charset="UTF-8"' },
    });
  }

  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data: orders, error } = await createAdminClient()
    .from("orders")
    .select(AD_ORDER_COLUMNS)
    .not("ad_click_id", "is", null)
    .neq("status", "Awaiting Payment")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load orders." }, { status: 500 });

  return new NextResponse(buildAdConversionsCsv(orders ?? []), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
