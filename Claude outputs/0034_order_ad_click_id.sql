-- 0034_order_ad_click_id.sql
--
-- Remember which Google Ads click (if any) sent the customer to the store.
--
-- The Google tag keeps the click ID (the "gclid") in a first-party cookie
-- called _gcl_aw when someone arrives from an ad. Checkout now copies it onto
-- the order (see src/lib/ads/adClickId.ts), so:
--   * the admin Orders page can show which orders came from an ad click, and
--   * an ad order Google didn't credit can still be uploaded to Google Ads by
--     hand (Goals > Uploads) using this ID.
--
-- Null for every order placed before this migration, and for any order whose
-- buyer didn't arrive from an ad (or whose browser blocked the cookie).
-- Checkout never depends on this column: it is filled in by a separate
-- best-effort update, so orders still go through even before this SQL is run.

alter table public.orders
  add column if not exists ad_click_id text;

comment on column public.orders.ad_click_id is
  'Google Ads click ID (gclid) from the _gcl_aw cookie at checkout, if the buyer arrived from an ad.';
