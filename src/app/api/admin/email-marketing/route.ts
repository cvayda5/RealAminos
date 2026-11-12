import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETING_TEMPLATES } from "@/lib/email/marketing/templates";
import { getOpenCampaign, getSettings, startCampaign } from "@/lib/email/marketing/campaigns";
import { postalAddress, sendMarketingBatch } from "@/lib/email/marketing/sendMarketing";

export const dynamic = "force-dynamic";

interface Body {
  action?: "settings" | "test" | "start-now";
  enabled?: boolean;
  intervalHours?: number;
  sendHour?: number;
  templateIndex?: number;
}

// POST /api/admin/email-marketing — admin-only controls for the every-2-days
// marketing email: turn it on/off, change the interval and send hour, send
// yourself a test, or start the next send right now.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const admin = createAdminClient();

  if (body.action === "settings") {
    await getSettings(admin); // makes sure the row exists
    const patch: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") {
      if (body.enabled && !postalAddress()) {
        return NextResponse.json(
          { error: "Set MARKETING_POSTAL_ADDRESS in Vercel first — every marketing email must show your mailing address." },
          { status: 400 }
        );
      }
      patch.enabled = body.enabled;
    }
    if (body.intervalHours !== undefined) {
      const h = Math.floor(Number(body.intervalHours));
      if (!Number.isFinite(h) || h < 1 || h > 720) {
        return NextResponse.json({ error: "Interval must be between 1 and 720 hours." }, { status: 400 });
      }
      patch.interval_hours = h;
    }
    if (body.sendHour !== undefined) {
      const h = Math.floor(Number(body.sendHour));
      if (!Number.isFinite(h) || h < 0 || h > 20) {
        return NextResponse.json({ error: "Send hour must be between 0 and 20." }, { status: 400 });
      }
      patch.send_hour_az = h;
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    const { error } = await admin.from("marketing_settings").update(patch).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "test") {
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY is not set." }, { status: 500 });
    if (!postalAddress()) {
      return NextResponse.json({ error: "Set MARKETING_POSTAL_ADDRESS in Vercel first." }, { status: 400 });
    }
    if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
    const idx = Math.floor(Number(body.templateIndex ?? 0));
    const template = MARKETING_TEMPLATES[idx];
    if (!template || !user.email) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    const ok = await sendMarketingBatch(template, [user.email.toLowerCase()]);
    if (!ok) return NextResponse.json({ error: "The test email could not be sent — check the Vercel logs." }, { status: 502 });
    return NextResponse.json({ ok: true, sentTo: user.email });
  }

  if (body.action === "start-now") {
    const settings = await getSettings(admin);
    if (!settings.enabled) {
      return NextResponse.json({ error: "Turn sending on first." }, { status: 400 });
    }
    if (await getOpenCampaign(admin)) {
      return NextResponse.json({ error: "A send is already in progress." }, { status: 409 });
    }
    const campaign = await startCampaign(admin, settings);
    if (!campaign) return NextResponse.json({ error: "Couldn't start a send — try again." }, { status: 500 });
    return NextResponse.json({ ok: true, template: campaign.template_key });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
