import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAbandonedCheckoutEmail, type AbandonedItem, type AbandonedStage } from "@/lib/email/sendAbandonedCheckoutEmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hours after the customer's last checkout activity that reminder #1, #2 and
// #3 become due.
const STAGE_HOURS = [1, 24, 72];
// Never send two reminders closer together than this — so if the scheduler
// was down for a day, the customer doesn't get #1, #2 and #3 back to back.
const MIN_GAP_HOURS = 12;
// Carts untouched this long are closed out without any more email.
const STALE_DAYS = 10;
const BATCH = 50;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Run every ~10 minutes by a Supabase pg_cron job (see the setup SQL). Sends
// at most one reminder per customer per run.
async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Close out very old carts.
  await admin
    .from("abandoned_checkouts")
    .update({ completed_at: nowIso })
    .is("completed_at", null)
    .lt("last_activity_at", new Date(now - STALE_DAYS * 86400000).toISOString());

  const { data: rows, error } = await admin
    .from("abandoned_checkouts")
    .select("*")
    .is("completed_at", null)
    .eq("unsubscribed", false)
    .lt("emails_sent", 3)
    .lte("last_activity_at", new Date(now - STAGE_HOURS[0] * 3600000).toISOString())
    .order("last_activity_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("abandoned-checkouts cron: query failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let completed = 0;
  let waiting = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const stageIndex: number = row.emails_sent;
    const ageHours = (now - new Date(row.last_activity_at).getTime()) / 3600000;
    if (ageHours < STAGE_HOURS[stageIndex]) {
      waiting++;
      continue;
    }
    if (stageIndex > 0 && row.last_email_at) {
      const sinceLast = (now - new Date(row.last_email_at).getTime()) / 3600000;
      if (sinceLast < MIN_GAP_HOURS) {
        waiting++;
        continue;
      }
    }

    // Did they actually check out? Any paid order since they entered their
    // shipping info ends the sequence.
    const { data: paid } = await admin
      .from("orders")
      .select("id")
      .eq("user_id", row.user_id)
      .in("status", ["Processing", "Shipped", "Delivered"])
      .gte("created_at", row.captured_at)
      .limit(1);
    if (paid && paid.length > 0) {
      await admin.from("abandoned_checkouts").update({ completed_at: nowIso }).eq("id", row.id);
      completed++;
      continue;
    }

    // Claim this stage atomically so two overlapping runs can't both send it.
    const { data: claimed } = await admin
      .from("abandoned_checkouts")
      .update({ emails_sent: stageIndex + 1, last_email_at: nowIso })
      .eq("id", row.id)
      .eq("emails_sent", stageIndex)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const ok = await sendAbandonedCheckoutEmail({
      toEmail: row.email,
      firstName: row.first_name,
      stage: (stageIndex + 1) as AbandonedStage,
      items: row.items as AbandonedItem[],
      subtotal: Number(row.subtotal),
      unsubscribeToken: row.unsubscribe_token,
    });

    if (ok) {
      sent++;
    } else {
      // Release the claim so the next run retries it.
      await admin
        .from("abandoned_checkouts")
        .update({ emails_sent: stageIndex, last_email_at: row.last_email_at })
        .eq("id", row.id);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, completed, waiting, failed });
}

export const GET = run;
export const POST = run;
