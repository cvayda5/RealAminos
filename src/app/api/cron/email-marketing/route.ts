import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchRecipients,
  fetchSentEmails,
  getLastCampaign,
  getOpenCampaign,
  getSettings,
  isDue,
  startCampaign,
  templateByKey,
} from "@/lib/email/marketing/campaigns";
import { postalAddress, sendMarketingBatch } from "@/lib/email/marketing/sendMarketing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Resend's batch endpoint takes up to 100 emails per call; stay well inside the
// 60-second limit and Resend's rate limit by doing at most 3 calls per run. The
// 10-minute schedule finishes a longer list over the next runs.
const BATCH_SIZE = 100;
const MAX_PER_RUN = 300;
// A send still unfinished after this long is closed out rather than resumed
// days later (for example if sending was paused part-way).
const ABANDON_AFTER_HOURS = 24;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pinged every ~10 minutes by a Supabase pg_cron job (0038). Starts the next
// marketing campaign when one is due (every `interval_hours`, default 48) and
// keeps delivering an in-progress one. See src/lib/email/marketing/.
async function run(request: Request) {
  if (!authorized(request)) {
    // TEMPORARY DIAGNOSTIC (remove once the secret works): lengths only, never
    // the secret itself. Lets us see whether the deployed CRON_SECRET is the
    // value the schedule is sending.
    const configured = process.env.CRON_SECRET ?? "";
    const header = request.headers.get("authorization") ?? "";
    return NextResponse.json(
      {
        error: "Unauthorized.",
        debug: {
          secretConfigured: configured.length > 0,
          configuredLength: configured.length,
          expectedHeaderLength: configured.length + 7,
          receivedHeaderLength: header.length,
          receivedStartsWithBearer: header.startsWith("Bearer "),
          configuredHasWhitespaceAtEnds: configured !== configured.trim(),
        },
      },
      { status: 401 }
    );
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY is not set." }, { status: 500 });
  }
  // Commercial email must carry a postal address — refuse to send without one.
  if (!postalAddress()) {
    return NextResponse.json(
      { ok: false, error: "MARKETING_POSTAL_ADDRESS is not set (required in every marketing email)." },
      { status: 500 }
    );
  }

  const admin = createAdminClient();
  const settings = await getSettings(admin);
  if (!settings.enabled) {
    return NextResponse.json({ ok: true, skipped: "sending is turned off" });
  }

  const now = Date.now();
  let campaign = await getOpenCampaign(admin);

  if (campaign && (now - new Date(campaign.created_at).getTime()) / 3600000 > ABANDON_AFTER_HOURS) {
    const sent = await fetchSentEmails(admin, campaign.id);
    await admin
      .from("marketing_campaigns")
      .update({ completed_at: new Date(now).toISOString(), sent_count: sent.size })
      .eq("id", campaign.id);
    campaign = null;
  }

  if (!campaign) {
    const last = await getLastCampaign(admin);
    if (!isDue(settings, last, now)) {
      return NextResponse.json({ ok: true, skipped: "not due yet" });
    }
    campaign = await startCampaign(admin, settings);
    if (!campaign) return NextResponse.json({ ok: true, skipped: "another run started it" });
  }

  const template = templateByKey(campaign.template_key);
  if (!template) {
    await admin
      .from("marketing_campaigns")
      .update({ completed_at: new Date(now).toISOString() })
      .eq("id", campaign.id);
    return NextResponse.json({ ok: false, error: `Unknown template ${campaign.template_key}` }, { status: 500 });
  }

  let recipients: string[];
  let alreadySent: Set<string>;
  try {
    [recipients, alreadySent] = await Promise.all([fetchRecipients(admin), fetchSentEmails(admin, campaign.id)]);
  } catch (err) {
    console.error("email-marketing: could not load recipients", err);
    return NextResponse.json({ ok: false, error: "Could not load recipients." }, { status: 500 });
  }

  const todo = recipients.filter((e) => !alreadySent.has(e));
  if (todo.length === 0) {
    await admin
      .from("marketing_campaigns")
      .update({ completed_at: new Date().toISOString(), sent_count: alreadySent.size })
      .eq("id", campaign.id);
    return NextResponse.json({ ok: true, completed: true, total: alreadySent.size });
  }

  let sent = 0;
  let failed = false;
  const slice = todo.slice(0, MAX_PER_RUN);
  for (let i = 0; i < slice.length; i += BATCH_SIZE) {
    const chunk = slice.slice(i, i + BATCH_SIZE);

    // Claim these recipients first so an overlapping run can't email them too.
    const { data: claimedRows } = await admin
      .from("marketing_sends")
      .upsert(
        chunk.map((email) => ({ campaign_id: campaign!.id, email })),
        { onConflict: "campaign_id,email", ignoreDuplicates: true }
      )
      .select("email");
    const claimed = (claimedRows ?? []).map((r) => String(r.email));
    if (claimed.length === 0) continue;

    const ok = await sendMarketingBatch(template, claimed);
    if (!ok) {
      // Release the claim so the next run retries them.
      await admin.from("marketing_sends").delete().eq("campaign_id", campaign.id).in("email", claimed);
      failed = true;
      break;
    }
    sent += claimed.length;
    if (i + BATCH_SIZE < slice.length) await sleep(700);
  }

  await admin
    .from("marketing_campaigns")
    .update({ sent_count: alreadySent.size + sent })
    .eq("id", campaign.id);

  return NextResponse.json({ ok: !failed, campaign: campaign.template_key, sent, remaining: todo.length - sent });
}

export const GET = run;
export const POST = run;
