-- RealAminos — "new order" email now fires from the thank-you page
-- Run this in the Supabase SQL Editor after 0030.
--
-- The "New Order" email to the owner used to go out the moment an order was
-- created (before it was paid). It now goes out when the customer reaches the
-- /thank-you page — and, as a safety net for card/Bitcoin customers who close
-- the tab before it loads, when the payment is auto-confirmed. This column
-- records that it was sent, so it only ever sends once per order.
alter table public.orders add column if not exists admin_notified_at timestamptz;

-- Orders that already exist were handled by the old flow (email at checkout) —
-- mark them done so nobody gets a second email for them.
update public.orders set admin_notified_at = now() where admin_notified_at is null;
