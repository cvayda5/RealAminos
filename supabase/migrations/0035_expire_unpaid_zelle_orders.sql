-- RealAminos — automatically delete unpaid Zelle orders after 20 minutes
-- Run this in the Supabase SQL Editor after 0034.
--
-- A Zelle order is created the moment the customer picks Zelle, with status
-- "Awaiting Payment". The customer then has 20 minutes to send the money and
-- tap "I've Sent My Zelle Payment" (see ZellePaymentStatus.tsx). If they never
-- do, this job deletes the order so abandoned Zelle orders don't pile up in
-- /admin/orders.
--
-- Only Zelle orders still in "Awaiting Payment" are ever touched. Card
-- (Square) and Bitcoin orders, and anything already Processing / Shipped /
-- Delivered, are never deleted by this.
--
-- What happens to the order's rows:
--   * order_items are removed automatically (FK is "on delete cascade").
--   * Points-redeemed rewards that were attached to the order are released —
--     order_id is cleared so the customer can use that reward again, rather
--     than losing the points for an order that never happened.
--
-- Runs every minute inside the database (pg_cron) — no web request, no secret
-- and nothing to set up in Vercel. If the customer taps "I've Sent My Zelle
-- Payment" at the same moment, whichever happens first wins: the order rows
-- are locked here, so a paid order can never be deleted.

create extension if not exists pg_cron;

create or replace function public.expire_unpaid_zelle_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_ids uuid[];
begin
  -- Lock the expired orders first so a customer "mark paid" click can't
  -- slip in between the steps below.
  select coalesce(array_agg(id), '{}')
    into expired_ids
    from (
      select id
        from public.orders
       where payment_method = 'zelle'
         and status = 'Awaiting Payment'
         and created_at < now() - interval '20 minutes'
       for update skip locked
    ) o;

  if coalesce(array_length(expired_ids, 1), 0) = 0 then
    return 0;
  end if;

  -- Give redeemed rewards back to the customer.
  update public.point_transactions
     set order_id = null
   where order_id = any (expired_ids)
     and type = 'redeemed';

  -- Anything else still pointing at these orders (should be nothing for an
  -- unpaid order) is removed so the delete below can't be blocked.
  delete from public.point_transactions
   where order_id = any (expired_ids);

  delete from public.orders
   where id = any (expired_ids);

  return array_length(expired_ids, 1);
end;
$$;

-- Only the scheduled job (and the SQL editor) should ever run this.
revoke all on function public.expire_unpaid_zelle_orders() from public, anon, authenticated;

-- Every minute. Re-running this file just replaces the job.
select cron.schedule(
  'expire-unpaid-zelle-orders',
  '* * * * *',
  $$select public.expire_unpaid_zelle_orders();$$
);
