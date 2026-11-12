-- RealAminos — email marketing (one email to every signed-up contact, every 2 days)
-- Run this in the Supabase SQL Editor after 0036.
--
-- How it works: a scheduled job (0038) pings /api/cron/email-marketing every
-- 10 minutes. When a send is due, the endpoint starts a "campaign" (one email
-- from the rotating templates in src/lib/email/marketing/templates.ts) and
-- sends it, 100 recipients at a time, to everyone who signed up — account
-- holders, Coming Soon signups and affiliate applicants, de-duplicated —
-- minus anyone who has unsubscribed.
--
-- All four tables are staff-only; the cron endpoint and the unsubscribe page
-- use the service-role client.

-- One row of settings. Sending starts OFF — switch it on from
-- /admin/email-marketing once you've sent yourself a test.
create table if not exists public.marketing_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  -- Hours between sends. 48 = every 2 days.
  interval_hours integer not null default 48 check (interval_hours between 1 and 720),
  -- Earliest hour (Arizona time, 0-23) a scheduled send may start.
  send_hour_az smallint not null default 10 check (send_hour_az between 0 and 20),
  -- Which template goes next (wraps around the template list).
  next_template integer not null default 0
);
insert into public.marketing_settings (id) values (1) on conflict (id) do nothing;

-- Everyone who clicked an unsubscribe link (case-insensitive, never emailed again).
create table if not exists public.marketing_unsubscribes (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- One row per send-out (every ~2 days).
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  subject text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  sent_count integer not null default 0
);

-- Only one campaign can be "in progress" at a time, so two overlapping cron
-- runs can never start the same send twice.
create unique index if not exists marketing_one_open_campaign
  on public.marketing_campaigns ((true))
  where completed_at is null;

-- Who already got which campaign — what makes a send resumable and
-- duplicate-proof.
create table if not exists public.marketing_sends (
  campaign_id uuid not null references public.marketing_campaigns (id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (campaign_id, email)
);

alter table public.marketing_settings enable row level security;
alter table public.marketing_unsubscribes enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_sends enable row level security;

create policy "marketing_settings_admin_all" on public.marketing_settings
  for all using (public.is_admin()) with check (public.is_admin());
create policy "marketing_unsubscribes_admin_all" on public.marketing_unsubscribes
  for all using (public.is_admin()) with check (public.is_admin());
create policy "marketing_campaigns_admin_all" on public.marketing_campaigns
  for all using (public.is_admin()) with check (public.is_admin());
create policy "marketing_sends_admin_all" on public.marketing_sends
  for all using (public.is_admin()) with check (public.is_admin());
