-- RealAminos — free local delivery (Arizona, within 50 miles of Surprise)
-- Run this in the Supabase SQL Editor after 0032.
--
-- Records how an order gets to the customer. 'ship' = normal carrier
-- shipping (the default, so every existing order is unchanged); 'local' =
-- delivered by us, free, same or next day. The checkout routes verify the
-- address server-side before ever saving 'local'.
alter table public.orders
  add column if not exists delivery_method text not null default 'ship';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_delivery_method_check'
  ) then
    alter table public.orders
      add constraint orders_delivery_method_check check (delivery_method in ('ship', 'local'));
  end if;
end $$;
