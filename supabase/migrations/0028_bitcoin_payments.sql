-- RealAminos — Bitcoin payments via BTCPay Server.
--
-- Run this whole file in the Supabase SQL Editor (one Run is fine — unlike
-- 0012 it adds no enum value, payment_method is a plain text column with a
-- CHECK constraint).
--
-- 1. Lets orders.payment_method be 'bitcoin' (it was limited to
--    'card' | 'zelle' by 0013_zelle_payments.sql).
-- 2. Stores which BTCPay invoice an order belongs to, so the BTCPay webhook
--    can find the order again when the payment confirms, plus the hosted
--    checkout link so My Orders can send the customer back to it.

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
    check (payment_method in ('card', 'zelle', 'bitcoin'));

alter table public.orders
  add column if not exists btcpay_invoice_id text;

alter table public.orders
  add column if not exists btcpay_checkout_url text;

-- One order per invoice — also makes the webhook's lookup by invoice id fast.
create unique index if not exists orders_btcpay_invoice_id_key
  on public.orders (btcpay_invoice_id)
  where btcpay_invoice_id is not null;
