-- realaminos — shipping info on orders
-- Run this in the Supabase SQL Editor after 0001, 0002, and 0003.
--
-- There's no real payment processor wired up yet, but every order still
-- needs to go somewhere — this adds the columns to actually record who to
-- ship to. Nullable at the database level so existing test orders placed
-- before this migration don't break; the checkout form and API route are
-- what actually make these required going forward for new orders.

alter table public.orders
  add column if not exists shipping_name text,
  add column if not exists shipping_phone text,
  add column if not exists shipping_email text,
  add column if not exists shipping_address_line1 text,
  add column if not exists shipping_address_line2 text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_zip text;
