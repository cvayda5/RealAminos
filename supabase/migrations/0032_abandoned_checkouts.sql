-- RealAminos — checkout abandonment emails
-- Run this in the Supabase SQL Editor after 0031.
--
-- One row per customer who entered their shipping info at checkout. A
-- scheduled job (see /api/cron/abandoned-checkouts) emails them at 1 hour,
-- 24 hours and 72 hours after their last checkout activity, unless they've
-- paid for an order in the meantime or unsubscribed.
--
-- Service-role only: no customer-facing policies. The capture endpoint
-- (/api/checkout/abandonment) writes with the service-role client after
-- checking the customer is signed in, and the emails always go to the
-- ACCOUNT's own email address, never an address typed into the form.

create table if not exists public.abandoned_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  first_name text,
  -- [{ productName, size, qty, unitPrice }] — paid lines only, real prices.
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10, 2) not null default 0,
  captured_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  emails_sent smallint not null default 0,
  last_email_at timestamptz,
  -- Set when they paid (or the row went stale) — nothing more is sent.
  completed_at timestamptz,
  unsubscribed boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid()
);

create index if not exists abandoned_checkouts_due_idx
  on public.abandoned_checkouts (last_activity_at)
  where completed_at is null and unsubscribed = false;

create unique index if not exists abandoned_checkouts_unsub_token_key
  on public.abandoned_checkouts (unsubscribe_token);

alter table public.abandoned_checkouts enable row level security;

create policy "abandoned_checkouts_admin_all" on public.abandoned_checkouts
  for all using (public.is_admin()) with check (public.is_admin());
