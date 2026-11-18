-- Meta (Facebook / Instagram) Conversions API support.
--   meta_tracking        — the buyer's Meta browser IDs (_fbp / _fbc cookies),
--                          IP address and browser string, captured when the
--                          order is created, so the server-side Purchase event
--                          can be matched to the ad click that brought them.
--   meta_purchase_sent_at — set (once) when the Purchase has been reported to
--                          Meta; the claim that stops a double send.
-- Safe to run more than once.
alter table public.orders add column if not exists meta_tracking jsonb;
alter table public.orders add column if not exists meta_purchase_sent_at timestamptz;
