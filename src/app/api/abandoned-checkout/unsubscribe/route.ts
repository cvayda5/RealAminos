import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(message: string, status = 200) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head>
<body style="margin:0;background:#111827;color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;">
<div style="max-width:420px;text-align:center;"><div style="font-size:22px;font-weight:800;margin-bottom:14px;">real<span style="color:#f97316;">aminos</span></div>
<p style="font-size:16px;line-height:1.6;margin:0 0 18px;">${message}</p>
<a href="https://shoprealaminos.com" style="color:#f97316;font-weight:700;text-decoration:none;">Back to the shop</a></div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// GET /api/abandoned-checkout/unsubscribe?t=<token> — the link in every cart
// reminder email. The token is a random per-customer id (never guessable and
// never an email address); it only ever switches the reminders off.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!UUID.test(token)) return page("That unsubscribe link isn't valid.", 400);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("abandoned_checkouts")
    .update({ unsubscribed: true })
    .eq("unsubscribe_token", token)
    .select("id");

  if (error) return page("Something went wrong — please try the link again in a minute.", 500);
  if (!data || data.length === 0) return page("That unsubscribe link isn't valid.", 404);
  return page("You're unsubscribed — you won't get any more cart reminder emails.");
}
