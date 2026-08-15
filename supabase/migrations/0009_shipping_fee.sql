-- RealAminos — flat-rate shipping charge
-- Run this in the Supabase SQL Editor after 0001-0008.
--
-- Adds a shipping_fee column to orders. `subtotal` and `total` keep their
-- existing meaning (product cost before/after any discount code) so
-- Revenue Reports and Affiliate Sales, which both already sum `total` as
-- product revenue, don't need any changes — shipping_fee is a separate,
-- additional amount. What the customer actually pays is total +
-- shipping_fee, computed wherever it's shown (cart, order confirmation
-- email, account/admin order views) rather than stored as its own combined
-- column.
--
-- See src/lib/shipping/rate.ts for the actual rate table — free at $200+
-- product subtotal, a flat zone-estimated rate below that, based on
-- distance from Waddell, Arizona.

alter table public.orders
  add column if not exists shipping_fee numeric(10, 2) not null default 0;

-- Every order placed before this migration shipped for $0 (there was no
-- shipping charge at all yet), so the default of 0 is already the correct
-- historical value — no backfill needed.
