-- RealAminos — Zelle payments, part 2 of 2.
-- Run 0012_zelle_enum.sql FIRST, in its own separate Run, before this file.
--
-- Zelle checkout flow: a customer who chooses Zelle gets 5% off (see
-- src/app/api/checkout/zelle/route.ts) in exchange for us not getting
-- instant payment confirmation the way a card charge gives us. Their order
-- is created immediately with status 'Awaiting Payment' — a real row in
-- this same `orders` table, not a separate pending table like Whop uses,
-- since there's no external checkout session to wait on here. Staff then
-- manually confirm the Zelle payment actually landed (matching it by order
-- number, which customers are required to put in the Zelle payment note)
-- and click "Mark Paid & Fulfill" on /admin/orders, which is the only thing
-- that actually moves the order to 'Processing' and triggers stock
-- decrement / points / the confirmation email — see
-- src/app/api/admin/orders/[id]/mark-paid/route.ts.

alter table public.orders
  add column if not exists payment_method text not null default 'card'
    check (payment_method in ('card', 'zelle'));

alter table public.orders
  add column if not exists zelle_discount_amount numeric(10, 2) not null default 0;

-- Lets the admin mark-paid action (and anything else) resolve exactly which
-- product_variants row a line item belongs to directly, instead of having
-- to re-derive it from product_name text or the productId/variantId
-- overload that src/lib/inventory/resolveVariant.ts otherwise has to
-- untangle. Nullable because existing order_items rows predate this column.
alter table public.order_items
  add column if not exists product_id uuid references public.products(id);
