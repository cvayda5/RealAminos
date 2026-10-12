-- RealAminos — affiliate phone number
-- Run this in the Supabase SQL Editor after 0029.
--
-- Affiliates must now give a phone number when they apply. It's used to spot
-- an affiliate ordering with their own code (see
-- src/lib/checkout/resolveDiscount.ts): if the phone, email or Zelle contact
-- on an order matches the affiliate who owns the code, the code is refused.
--
-- Nullable because applications submitted before this existed don't have one
-- (those are still matched by email / Zelle contact); the public form and its
-- API route require it for every new application. Stored as digits only.
alter table public.affiliate_signups add column if not exists phone text;

comment on column public.affiliate_signups.phone is
  'Applicant phone number, digits only (US 10 digits). Used to block affiliates from using their own code on their own orders.';
