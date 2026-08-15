-- RealAminos — points redemption reworked to go through the cart
-- Run this in the Supabase SQL Editor after 0001-0007.
--
-- Redemption is no longer a single storewide points threshold. Each vial
-- now costs points proportional to its own current price (see
-- /api/points/redeem-to-cart), and redeeming adds the vial straight to the
-- cart instead of immediately placing an order. That means a redemption
-- can be reversed (removed from the cart before checkout) — `voided`
-- below is what makes that safe to do exactly once per redemption.

alter table public.point_transactions
  add column if not exists voided boolean not null default false;

comment on column public.point_transactions.voided is
  'Set true the moment a reserved (type=redeemed, order_id still null) '
  'transaction is refunded after being removed from the cart. Prevents the '
  'same reservation from being refunded twice. Rows that already have an '
  'order_id (the redemption was actually checked out) can no longer be '
  'refunded regardless of this flag — see /api/points/refund.';

-- point_settings (the old single storewide "points per free vial" number)
-- is no longer used by the app now that cost is derived per-vial from its
-- own price — left in place rather than dropped since it's harmless, in
-- case a storewide override is wanted again later.
