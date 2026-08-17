-- Whop is a temporary payment processor while a dedicated high-risk merchant
-- account is set up (see the project's build plan). This table bridges the
-- gap between "customer clicked Place Order" and "Whop actually confirms the
-- charge went through" — nothing in the real `orders` table gets created
-- until that confirmation arrives via webhook, so an abandoned/failed Whop
-- checkout never leaves a half-finished order sitting around.
--
-- All pricing (subtotal/discount/shipping/total) is computed and frozen here
-- at checkout-creation time, then reused as-is when the webhook finalizes the
-- order — never recomputed at webhook time, so the order always matches
-- exactly what Whop actually charged, even if a product's price changes
-- while the customer is sitting on Whop's checkout page.
create table pending_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  shipping jsonb not null,
  discount_code text,
  discount_percent numeric(5,2) not null default 0,
  subtotal numeric(10,2) not null,
  shipping_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  points_redeemed integer not null default 0,
  -- point_transactions ids reserved for reward lines in this checkout — on
  -- payment success these get linked to the finished order (same as
  -- /api/orders does today); on failure/expiry they get refunded back to the
  -- customer's balance, same as removing a reward from the cart does.
  reward_tx_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  whop_checkout_id text,
  created_at timestamptz not null default now()
);

alter table pending_checkouts enable row level security;

-- Same pattern as orders_insert_own: the checkout-creation route runs under
-- the customer's own session, so RLS (not app logic) is what actually stops
-- one user from creating a pending checkout under someone else's account.
create policy pending_checkouts_insert_own on pending_checkouts
  for insert
  with check (auth.uid() = user_id);

create policy pending_checkouts_select_own_or_admin on pending_checkouts
  for select
  using (auth.uid() = user_id or is_admin());

-- No update/delete policy for regular users at all, on purpose — the only
-- thing that ever transitions `status` is the Whop webhook handler, which
-- always runs as the service-role client (there's no session to authenticate
-- a webhook request against). Same reasoning as point_transactions having no
-- customer-facing write policy.
