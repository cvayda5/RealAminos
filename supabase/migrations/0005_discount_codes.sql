-- realaminos — discount codes
-- Run this in the Supabase SQL Editor after 0001-0004.
--
-- Adds a discount_codes table staff manage from /admin/discounts, and the
-- order-level columns needed to record which code (if any) was used and
-- what the customer actually paid after the discount.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off integer not null check (percent_off > 0 and percent_off <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.discount_codes enable row level security;

-- Staff manage codes entirely (create/edit/deactivate/delete) — enforced
-- again at the API layer (service-role client, after an explicit is_admin
-- check), this policy is defense in depth at the database level too.
create policy "discount_codes_admin_all" on public.discount_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- Deliberately NO select policy for regular customers here. Letting every
-- signed-in customer read this table directly would expose every code that
-- exists (including inactive ones) just by querying it from the browser.
-- Instead, checking a single code at checkout goes through
-- /api/discount-codes/validate, which uses the service-role client
-- server-side to look up exactly the one code requested and returns only
-- whether it's valid — never the full list.

-- ---------------------------------------------------------------
-- orders: record which code (if any) was applied and the final total.
-- `subtotal` keeps meaning "sum of line items before any discount" as it
-- always has; `total` is what the customer actually owes after the
-- discount. Nullable so existing pre-migration orders don't break — the
-- backfill below sets total = subtotal for those (no discount existed yet).
-- ---------------------------------------------------------------
alter table public.orders
  add column if not exists discount_code text,
  add column if not exists discount_percent integer not null default 0,
  add column if not exists total numeric(10, 2);

update public.orders set total = subtotal where total is null;
