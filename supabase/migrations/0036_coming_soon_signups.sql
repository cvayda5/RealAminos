-- RealAminos — "notify me when it's live" signups for the Coming Soon section
-- Run this in the Supabase SQL Editor after 0035.
--
-- Emails collected from the Coming Soon section on /shop/all. Staff-only: no
-- public read or insert policy. The public form posts to
-- /api/coming-soon/notify, which validates the address and writes with the
-- service-role client, so a visitor can sign up but can never read the list.
-- One row per email (case-insensitive), so repeat signups are harmless.

create table if not exists public.coming_soon_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  source text not null default 'shop-all',
  created_at timestamptz not null default now()
);

create unique index if not exists coming_soon_signups_email_key
  on public.coming_soon_signups (lower(email));

alter table public.coming_soon_signups enable row level security;

create policy "coming_soon_signups_admin_all" on public.coming_soon_signups
  for all using (public.is_admin()) with check (public.is_admin());
