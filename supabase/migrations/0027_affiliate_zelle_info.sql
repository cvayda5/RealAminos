-- Adds a Zelle payout field to affiliate signups, so staff have what they
-- need to actually pay an affiliate their commission (see /admin/affiliates
-- for the sales/revenue-per-code numbers this pairs with — that page
-- already says "use this to see exactly what an affiliate's code sold so
-- they can be paid accordingly"; this is the other half, where to send it).
--
-- Nullable because existing signups submitted before this field existed
-- don't have one — the public form and its API route enforce it as
-- required going forward for new applications.
alter table public.affiliate_signups add column if not exists zelle_info text;

comment on column public.affiliate_signups.zelle_info is
  'Email or phone number the applicant uses for Zelle, so staff can pay their affiliate commission. Free text (not validated as an email/phone) since Zelle accepts either.';
