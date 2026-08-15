-- RealAminos — rewards points program
-- Run this in the Supabase SQL Editor after 0001-0006.
--
-- Every dollar a customer actually pays (order.total, after any discount)
-- earns 1 point. Once a customer's balance reaches the current threshold,
-- they can redeem it for one free vial — no partial redemption, and no
-- combining points with a discount code on the same order.
--
-- Deliberately NOT tied to any specific product's price yet — the exact
-- points-per-vial number is a placeholder (100) meant to be adjusted from
-- /admin/points once real vial pricing is finalized, without a code change.

-- ---------------------------------------------------------------
-- point_settings: a single-row table holding the one number that
-- changes over time (how many points a free vial costs). The
-- `id integer primary key default 1 check (id = 1)` trick keeps this
-- to exactly one row — any second insert violates the primary key.
-- ---------------------------------------------------------------
create table if not exists public.point_settings (
  id integer primary key default 1 check (id = 1),
  points_per_free_vial integer not null default 100 check (points_per_free_vial > 0),
  updated_at timestamptz not null default now()
);

insert into public.point_settings (id, points_per_free_vial) values (1, 100)
on conflict (id) do nothing;

alter table public.point_settings enable row level security;

-- Everyone (including anonymous visitors) can read the current threshold —
-- it's shown on the public /points page so customers know what they're
-- working toward. Only staff can change it.
create policy "point_settings_select_all" on public.point_settings
  for select using (true);

create policy "point_settings_admin_update" on public.point_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- point_transactions: an append-only ledger. A customer's balance is
-- always the sum of their rows here (computed in the app, the same way
-- Revenue Reports sums orders in JS) rather than a separately-stored
-- counter — that avoids ever needing a client-writable balance column on
-- profiles, which would otherwise be an easy thing to tamper with from
-- the browser.
-- ---------------------------------------------------------------
create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Positive for 'earned', negative for 'redeemed' — summing this column
  -- directly gives the balance.
  points integer not null,
  type text not null check (type in ('earned', 'redeemed')),
  order_id uuid references public.orders (id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.point_transactions enable row level security;

-- Customers can see their own points history; staff can see everyone's.
create policy "point_transactions_select_own_or_admin" on public.point_transactions
  for select using (auth.uid() = user_id or public.is_admin());

-- Deliberately NO insert/update/delete policy for regular customers.
-- Points are only ever written by the server (service-role client) from
-- /api/orders (earning) and /api/points/redeem (spending), each after its
-- own validation — never a direct client write, so there's no RLS policy
-- that could accidentally let someone credit themselves points.

-- ---------------------------------------------------------------
-- orders: record how many points (if any) were spent redeeming this
-- specific order for a free vial, so it shows clearly on the order itself
-- in both the customer's Order history and the staff Orders page.
-- ---------------------------------------------------------------
alter table public.orders
  add column if not exists points_redeemed integer not null default 0;
