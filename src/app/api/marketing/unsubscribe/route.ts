import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribe } from "@/lib/email/marketing/unsubscribeToken";

function page(message: string, status = 200) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head>
<body style="margin:0;background:#111827;color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;">
<div style="max-width:420px;text-align:center;"><div style="font-size:22px;font-weight:800;margin-bottom:14px;">real<span style="color:#f97316;">aminos</span></div>
<p style="font-size:16px;line-height:1.6;margin:0 0 18px;">${message}</p>
<a href="https://shoprealaminos.com" style="color:#f97316;font-weight:700;text-decoration:none;">Back to the shop</a></div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function unsubscribe(url: URL): Promise<{ ok: boolean; status: number; message: string }> {
  const email = verifyUnsubscribe(url.searchParams.get("e") ?? "", url.searchParams.get("s") ?? "");
  if (!email) return { ok: false, status: 400, message: "That unsubscribe link isn't valid." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_unsubscribes")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    return { ok: false, status: 500, message: "Something went wrong — please try the link again in a minute." };
  }
  return { ok: true, status: 200, message: "You're unsubscribed — you won't get any more marketing emails from RealAminos. (Order and account emails still come through.)" };
}

// GET /api/marketing/unsubscribe?e=<email>&s=<signature> — the link in every
// marketing email. The signature proves the link came from us for that exact
// address, so it can't be used to unsubscribe anyone else.
export async function GET(request: Request) {
  const r = await unsubscribe(new URL(request.url));
  return page(r.message, r.status);
}

// RFC 8058 one-click unsubscribe: Gmail / Apple Mail POST to the same URL.
export async function POST(request: Request) {
  const r = await unsubscribe(new URL(request.url));
  return NextResponse.json({ ok: r.ok }, { status: r.status });
}
