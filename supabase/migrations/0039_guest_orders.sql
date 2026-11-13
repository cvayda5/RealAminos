-- RealAminos — guest checkout
-- Run this in the Supabase SQL Editor after 0038.
--
-- Lets an order exist without a customer account. Guest orders have a null
-- user_id and are identified by the email they entered at checkout
-- (orders.shipping_email). Everything else about an order is unchanged.
--
-- Guests can't earn or spend points (those belong to an account), and a
-- guest's order page is reachable only by its unguessable order id (the link
-- in their payment redirect / email), never by browsing.
--
-- Staff still see every order on /admin/orders — the admin policy already
-- covers orders with no user.

alter table public.orders alter column user_id drop not null;
