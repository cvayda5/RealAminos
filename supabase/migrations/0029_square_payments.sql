-- RealAminos — card payments via Square (hosted Payment Link).
--
-- Run this whole file in the Supabase SQL Editor (one Run is fine).
--
-- 1. Lets orders.payment_method be 'square' (it was limited to
--    'card' | 'zelle' | 'bitcoin' by 0028_bitcoin_payments.sql). 'card' stays
--    allowed — it's the legacy Whop value on old orders.
-- 2. Stores which Square order / payment link an order belongs to, so the
--    Square webhook can find the order again when the payment completes, plus
--    the hosted checkout link so My Orders can send the customer back to it.

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
    check (payment_method in ('card', 'zelle', 'bitcoin', 'square'));

alter table public.orders
  add column if not exists square_order_id text;

alter table public.orders
  add column if not exists square_payment_link_id text;

alter table public.orders
  add column if not exists square_checkout_url text;

-- One RealAminos order per Square order — also makes the webhook's lookup fast.
create unique index if not exists orders_square_order_id_key
  on public.orders (square_order_id)
  where square_order_id is not null;
