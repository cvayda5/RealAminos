// Campaign bookkeeping for the every-2-days marketing email: who gets it, when
// the next one is due, and starting a campaign. Used by the cron endpoint and
// the admin page.
import type { SupabaseClient } from "@supabase/supabase-js";
import { MARKETING_TEMPLATES, type MarketingTemplate } from "./templates";

export interface MarketingSettings {
  enabled: boolean;
  interval_hours: number;
  send_hour_az: number;
  next_template: number;
}

export interface MarketingCampaign {
  id: string;
  template_key: string;
  subject: string;
  created_at: string;
  completed_at: string | null;
  sent_count: number;
}

// The last hour of the day (Arizona time) a scheduled send may still START, so
// an outage never causes a late-night send.
const LAST_START_HOUR_AZ = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function templateByKey(key: string): MarketingTemplate | undefined {
  return MARKETING_TEMPLATES.find((t) => t.key === key);
}

export async function getSettings(admin: SupabaseClient): Promise<MarketingSettings> {
  await admin.from("marketing_settings").upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });
  const { data } = await admin
    .from("marketing_settings")
    .select("enabled, interval_hours, send_hour_az, next_template")
    .eq("id", 1)
    .single<MarketingSettings>();
  return data ?? { enabled: false, interval_hours: 48, send_hour_az: 10, next_template: 0 };
}

// Reads every row of a column from a table, a page at a time (Supabase returns
// at most 1000 rows per request).
async function fetchAllEmails(admin: SupabaseClient, table: string, orderBy: string): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from(table)
      .select("email")
      .order(orderBy, { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const r of data ?? []) out.push(String(r.email ?? ""));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function fetchEmailSet(admin: SupabaseClient, table: string, orderBy: string): Promise<Set<string>> {
  return new Set((await fetchAllEmails(admin, table, orderBy)).map((e) => e.trim().toLowerCase()));
}

/**
 * Everyone who signed up — accounts, Coming Soon signups and affiliate
 * applicants — lower-cased, valid, de-duplicated, and minus anyone who has
 * unsubscribed.
 */
export async function fetchRecipients(admin: SupabaseClient): Promise<string[]> {
  const [accounts, comingSoon, affiliates, unsubscribed] = await Promise.all([
    fetchAllEmails(admin, "profiles", "id"),
    fetchAllEmails(admin, "coming_soon_signups", "id"),
    fetchAllEmails(admin, "affiliate_signups", "id"),
    fetchEmailSet(admin, "marketing_unsubscribes", "email"),
  ]);
  const seen = new Set<string>();
  for (const raw of [...accounts, ...comingSoon, ...affiliates]) {
    const e = raw.trim().toLowerCase();
    if (e.length > 254 || !EMAIL_RE.test(e) || unsubscribed.has(e)) continue;
    seen.add(e);
  }
  return [...seen];
}

export async function fetchSentEmails(admin: SupabaseClient, campaignId: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("marketing_sends")
      .select("email")
      .eq("campaign_id", campaignId)
      .order("email", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.add(String(r.email));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function getOpenCampaign(admin: SupabaseClient): Promise<MarketingCampaign | null> {
  const { data } = await admin
    .from("marketing_campaigns")
    .select("*")
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<MarketingCampaign[]>();
  return data?.[0] ?? null;
}

export async function getLastCampaign(admin: SupabaseClient): Promise<MarketingCampaign | null> {
  const { data } = await admin
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<MarketingCampaign[]>();
  return data?.[0] ?? null;
}

// Arizona doesn't observe daylight saving time, so it's always UTC-7.
export function arizonaHour(now = Date.now()): number {
  return new Date(now - 7 * 3600000).getUTCHours();
}

/** Is a new campaign due right now? */
export function isDue(settings: MarketingSettings, last: MarketingCampaign | null, now = Date.now()): boolean {
  const hour = arizonaHour(now);
  if (hour < settings.send_hour_az || hour > LAST_START_HOUR_AZ) return false;
  if (!last) return true;
  // Half-hour of slack so the "every 48 hours" schedule never drifts a day
  // later because a run landed a few minutes early.
  const hoursSince = (now - new Date(last.created_at).getTime()) / 3600000;
  return hoursSince >= settings.interval_hours - 0.5;
}

/**
 * Starts the next campaign (the next template in the rotation). Returns null
 * if one is already in progress.
 */
export async function startCampaign(admin: SupabaseClient, settings: MarketingSettings): Promise<MarketingCampaign | null> {
  const template = MARKETING_TEMPLATES[settings.next_template % MARKETING_TEMPLATES.length];
  const { data, error } = await admin
    .from("marketing_campaigns")
    .insert({ template_key: template.key, subject: template.subject })
    .select("*")
    .single<MarketingCampaign>();
  // 23505 = the unique "one open campaign" index: another run already started it.
  if (error || !data) return null;
  await admin
    .from("marketing_settings")
    .update({ next_template: (settings.next_template + 1) % MARKETING_TEMPLATES.length })
    .eq("id", 1);
  return data;
}
