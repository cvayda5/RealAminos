-- Reverts the 20% price increase from 0024_price_increase_20pct.sql back to
-- each variant's real, confirmed original price, and adds an explicit
-- stored "was" price so the storefront can show it struck through next to
-- the (now-restored) real price — see chat: a runtime reversal like
-- round(current_price / 1.2, 2) does NOT reliably reconstruct clean, real
-- original prices (several variants were touched up by hand after 0024 ran,
-- so current price isn't a pure function of the original one). The values
-- below instead come from a Google Merchant Center feed snapshot the user
-- confirmed was taken before the price increase — real historical listed
-- prices, not a guess or a formula.
--
-- Run this AFTER 0024. Safe to run more than once (idempotent): the
-- compare_at_price capture below always re-snapshots whatever is currently
-- in `price` first, then the per-variant updates always set the exact same
-- literal target values regardless of current state.

alter table public.product_variants add column if not exists compare_at_price numeric(10, 2);

comment on column public.product_variants.compare_at_price is
  'Optional higher reference price to show struck through next to the real (charged) price. NULL, or <= price, means: nothing to show crossed out. Set explicitly by migration/admin — never computed at runtime.';

-- Snapshot whatever is CURRENTLY live (the post-20%-increase price, exactly
-- as charged today) as the "was" price shown crossed out, before the real
-- charged price gets reverted below. Using the DB's own current value here
-- (rather than recomputing one) means this is accurate regardless of any
-- manual price touch-ups made after 0024 ran.
update public.product_variants set compare_at_price = price;

-- Revert the real, active/charged price back to each variant's confirmed
-- original (pre-increase) price. Matched by exact product_id + size (both
-- taken straight from the merchant feed's item ids, e.g.
-- "6ec0d964-...-5mg" -> product_id 6ec0d964-..., size "5mg") so there's no
-- ambiguity from product-name matching.

-- CJC-1295 (with DAC)
update public.product_variants set price = 49.99
  where product_id = '6ec0d964-1c36-42b8-ba01-6d1bb576e2d8' and size = '5mg';

-- Ipamorelin
update public.product_variants set price = 37.99
  where product_id = 'c518c67b-2e55-4957-8870-b2592bf90e92' and size = '5mg';
update public.product_variants set price = 37.99
  where product_id = 'c518c67b-2e55-4957-8870-b2592bf90e92' and size = '10mg';

-- Tesamorelin
update public.product_variants set price = 99.99
  where product_id = '0d9fecad-c725-4e2a-a0b0-0810b5f0230f' and size = '5mg';
update public.product_variants set price = 99.99
  where product_id = '0d9fecad-c725-4e2a-a0b0-0810b5f0230f' and size = '10mg';

-- GLP-1 (SG)
update public.product_variants set price = 59.99
  where product_id = '17c2419b-5780-4a76-b8fe-df247a667c6f' and size = '5mg';
update public.product_variants set price = 59.99
  where product_id = '17c2419b-5780-4a76-b8fe-df247a667c6f' and size = '10mg';

-- GLP-3 (RT)
update public.product_variants set price = 75.99
  where product_id = 'fefe28ce-f315-4477-bdba-e022dfca8017' and size = '10mg';
update public.product_variants set price = 75.99
  where product_id = 'fefe28ce-f315-4477-bdba-e022dfca8017' and size = '20mg';

-- TB-500
update public.product_variants set price = 54.99
  where product_id = '504b07cc-70c3-475b-ae0a-7e673630c5a5' and size = '5mg';
update public.product_variants set price = 54.99
  where product_id = '504b07cc-70c3-475b-ae0a-7e673630c5a5' and size = '10mg';
update public.product_variants set price = 54.99
  where product_id = '504b07cc-70c3-475b-ae0a-7e673630c5a5' and size = '20mg';

-- GHK-Cu
update public.product_variants set price = 37.99
  where product_id = '431876e1-709e-4886-a03a-0750fcfa469c' and size = '50mg';
update public.product_variants set price = 37.99
  where product_id = '431876e1-709e-4886-a03a-0750fcfa469c' and size = '100mg';

-- BPC-157
update public.product_variants set price = 41.99
  where product_id = '36273cec-e348-4706-a822-a8f8f6881f15' and size = '5mg';
update public.product_variants set price = 41.99
  where product_id = '36273cec-e348-4706-a822-a8f8f6881f15' and size = '10mg';
update public.product_variants set price = 41.99
  where product_id = '36273cec-e348-4706-a822-a8f8f6881f15' and size = '20mg';

-- MT-2 (Melanotan II)
update public.product_variants set price = 41.99
  where product_id = 'f001d6bb-a539-4769-a7ba-5ec4019ab796' and size = '5mg';
update public.product_variants set price = 41.99
  where product_id = 'f001d6bb-a539-4769-a7ba-5ec4019ab796' and size = '10mg';

-- Selank
update public.product_variants set price = 29.99
  where product_id = '8a386de9-897f-4b64-8389-514faa990821' and size = '10mg';
update public.product_variants set price = 29.99
  where product_id = '8a386de9-897f-4b64-8389-514faa990821' and size = '30mg';

-- Semax
update public.product_variants set price = 47.99
  where product_id = '868d793e-9552-4322-9f0e-4a921419fbd3' and size = '10mg';
update public.product_variants set price = 47.99
  where product_id = '868d793e-9552-4322-9f0e-4a921419fbd3' and size = '30mg';

-- BAC Water
update public.product_variants set price = 10.99
  where product_id = '2a8ffde4-aec8-4224-856b-a0c7830ad4ec' and size = '3mL';
update public.product_variants set price = 10.99
  where product_id = '2a8ffde4-aec8-4224-856b-a0c7830ad4ec' and size = '10mL';

-- Sanity check after running: every row below should show a real discount
-- (compare_at_price clearly higher than price, never equal/lower). If any
-- product/size you expected here doesn't show up, it means the feed didn't
-- have that exact size and it kept the post-increase price with nothing to
-- show struck through — flag it and it can be added by hand.
-- select p.name, v.size, v.price, v.compare_at_price
-- from public.product_variants v join public.products p on p.id = v.product_id
-- order by p.name, v.sort_order;
