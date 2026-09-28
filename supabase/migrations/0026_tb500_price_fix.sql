-- Fixes TB-500 specifically. 0025_restore_original_prices.sql used a
-- Google Merchant feed value ($54.99 flat) for TB-500 that turned out to be
-- wrong/stale — the real pre-migration prices (captured into
-- compare_at_price by 0025) were actually tiered per size ($39.99 / $52.99 /
-- $74.99), and none of the usual reconstruction approaches (feed data, or
-- reversing the 20% increase) produced a trustworthy number. Per chat, the
-- user is setting these directly rather than trying to reconstruct history:
-- 10mg "was" $68.99, now $50.00. The 5mg/20mg were asked for as "a little
-- less" / "a little more" — sized here to roughly the same proportional
-- spread TB-500's own real tiered pricing had before (5mg ran about 76% of
-- 10mg, 20mg about 141% of 10mg), rounded to clean numbers. Flag these if
-- they're not what was wanted — easy one-line changes.
--
-- Safe to run more than once (idempotent) — always sets the same literal
-- target values regardless of current state.

-- 5mg — a little less than 10mg
update public.product_variants set price = 40.00, compare_at_price = 54.99
  where product_id = '504b07cc-70c3-475b-ae0a-7e673630c5a5' and size = '5mg';

-- 10mg — as given: was $68.99, now $50.00
update public.product_variants set price = 50.00, compare_at_price = 68.99
  where product_id = '504b07cc-70c3-475b-ae0a-7e673630c5a5' and size = '10mg';

-- 20mg — a little more than 10mg
update public.product_variants set price = 70.00, compare_at_price = 97.99
  where product_id = '504b07cc-70c3-475b-ae0a-7e673630c5a5' and size = '20mg';

-- Sanity check:
-- select v.size, v.price, v.compare_at_price
-- from public.product_variants v
-- where v.product_id = '504b07cc-70c3-475b-ae0a-7e673630c5a5'
-- order by v.sort_order;
