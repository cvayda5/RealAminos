-- Adds columns for one-click Shippo label purchases from /admin/orders.
-- tracking_number already exists (0004_shipping_info.sql) and is reused as
-- the label's tracking number — no separate column needed for that.
alter table orders
  add column if not exists shipping_carrier text,
  add column if not exists shipping_service text,
  add column if not exists label_url text,
  add column if not exists label_purchased_at timestamptz,
  add column if not exists package_weight_oz numeric;

comment on column orders.shipping_carrier is 'e.g. "usps" — the carrier code Shippo returned for the purchased label.';
comment on column orders.shipping_service is 'e.g. "Priority Mail" — the human-readable service level of the purchased label.';
comment on column orders.label_url is 'Direct URL to the purchased label PDF, as returned by Shippo. Re-printable any time — Shippo keeps these URLs live.';
comment on column orders.label_purchased_at is 'When staff bought this label — null until the first purchase.';
comment on column orders.package_weight_oz is 'Weight staff entered when buying the label, kept for a record of what the rate was actually quoted against.';
