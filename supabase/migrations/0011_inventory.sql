-- realaminos — inventory tracking (run this AFTER 0010_whop_checkout.sql)
--
-- Adds a real stock quantity to every product size (product_variants), so
-- the storefront can show "Out of Stock — Coming Soon" instead of letting
-- customers buy something that isn't physically on hand. Every variant
-- starts at 0 on purpose — nothing here invents fake quantities on your
-- behalf. Set real numbers by hand for whatever you're actually launching
-- with at /admin/inventory; everything else just stays at 0 (out of stock)
-- until you do the same for it later.
alter table public.product_variants add column if not exists stock integer not null default 0;

-- Race-safe decrement, called once per line item when the Whop webhook
-- finalizes a real order (see finalizeOrder() in
-- src/app/api/webhooks/whop/route.ts). Floors at 0 instead of going
-- negative in the rare case two customers manage to buy the last unit at
-- the same moment — /api/checkout/whop already checks stock before a
-- customer is ever sent to pay, so this is a safety net, not the primary
-- guard.
--
-- SECURITY DEFINER so it can write regardless of who's asking, but grants
-- are locked down below to service_role only (the webhook always uses the
-- admin/service-role client) — without that restriction, any logged-in
-- customer could call this directly via the Supabase client and zero out a
-- competitor's... well, your own stock count for fun.
create or replace function public.decrement_variant_stock(p_variant_id uuid, p_qty integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.product_variants
  set stock = greatest(stock - p_qty, 0)
  where id = p_variant_id;
$$;

revoke execute on function public.decrement_variant_stock(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- CJC-1295 (with DAC) is a materially different research compound from the
-- "CJC-1295 (no DAC)" already seeded in 0001_init.sql (different behavior
-- in research contexts) — added as its own catalog entry rather than
-- repurposing the existing one, so both stay independently listed and the
-- "no DAC" product/pricing is untouched. CAS number and description are
-- left blank; there's no catalog-editing admin page yet, so fill those in
-- directly in this table (or ask for a follow-up admin page) whenever
-- convenient — nothing else depends on them being set.
-- ---------------------------------------------------------------
insert into public.products (name, category, is_active)
select 'CJC-1295 (with DAC)', 'GHRH / Secretagogue Peptides', true
where not exists (select 1 from public.products where name = 'CJC-1295 (with DAC)');

insert into public.product_variants (product_id, size, price, sort_order, stock)
select (select id from public.products where name = 'CJC-1295 (with DAC)'), '5mg', 59.99, 1, 0
where not exists (
  select 1
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where p.name = 'CJC-1295 (with DAC)' and pv.size = '5mg'
);
