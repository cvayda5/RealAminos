-- realaminos — initial schema
-- Run this in the Supabase dashboard's SQL Editor (or via the Supabase CLI)
-- against a fresh project. Safe to run once; re-running will error on the
-- "already exists" objects, which is expected.

-- ---------------------------------------------------------------
-- profiles: one row per auth user. Supabase Auth owns the actual
-- login/password/2FA state in its own internal auth.users table;
-- this table is where we attach our own fields (is_admin, etc).
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can see and update their own profile row.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Automatically create a profiles row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used inside RLS policies below. SECURITY DEFINER lets it read
-- profiles even though the *caller's* RLS would otherwise only let them
-- see their own row — this function is the one safe way around that.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------
-- products: your catalog. Mirrors the categories/compounds already
-- in the website prototype. Order items reference this by product_id
-- once you wire the real storefront up to this table; until then the
-- API also accepts a plain product_name (see order_items below).
-- ---------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cas_number text,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- Product catalog is public read (anyone visiting the store needs to see it).
create policy "products_select_all" on public.products
  for select using (true);

-- Only admins can add/edit/remove products.
create policy "products_write_admin" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- orders / order_items
-- ---------------------------------------------------------------
create type public.order_status as enum ('Processing', 'Shipped', 'Delivered');

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,       -- human-friendly, e.g. ORD-1044
  user_id uuid not null references auth.users (id) on delete restrict,
  status public.order_status not null default 'Processing',
  tracking_number text,
  subtotal numeric(10, 2) not null,
  waiver_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Customers can see only their own orders; admins can see every order.
create policy "orders_select_own_or_admin" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

-- Customers can create orders for themselves (checkout).
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

-- Only admins can change status/tracking (fulfillment updates).
create policy "orders_update_admin" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_name text not null,
  size text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(10, 2) not null
);

alter table public.order_items enable row level security;

-- Visible to whoever can see the parent order.
create policy "order_items_select_via_order" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

-- Insertable only alongside an order the same user just created.
create policy "order_items_insert_via_own_order" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- A short, incrementing order number (ORD-1000, ORD-1001, ...) instead of
-- exposing the raw UUID to customers.
create sequence if not exists public.order_number_seq start 1000;

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null then
    new.order_number := 'ORD-' || nextval('public.order_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_order_number on public.orders;
create trigger trg_set_order_number
  before insert on public.orders
  for each row execute procedure public.set_order_number();

-- ---------------------------------------------------------------
-- Seed catalog data (matches the website prototype's launch lineup).
-- Safe to delete/edit — this just saves you re-typing it by hand.
-- ---------------------------------------------------------------
insert into public.products (name, cas_number, category) values
  ('BPC-157', '137525-51-0', 'Growth Factor Peptides'),
  ('TB-500', '885340-08-9', 'Growth Factor Peptides'),
  ('GHK-Cu', '49557-75-7', 'Growth Factor Peptides'),
  ('CJC-1295 (no DAC)', '446036-97-1', 'GHRH / Secretagogue Peptides'),
  ('Ipamorelin', '170851-70-4', 'GHRH / Secretagogue Peptides'),
  ('Tesamorelin', '218949-48-5', 'GHRH / Secretagogue Peptides'),
  ('Semaglutide', '910463-68-2', 'GLP-1 Class Peptides'),
  ('Retatrutide', '2381089-83-2', 'GLP-1 Class Peptides'),
  ('Selank', '129954-34-3', 'Neuropeptides'),
  ('Semax', '80714-61-0', 'Neuropeptides'),
  ('MT-2 (Melanotan II)', '121062-08-6', 'Melanocortin Peptides'),
  ('BAC Water', '7732-18-5', 'Reconstitution Solvents')
on conflict do nothing;
