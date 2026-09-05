-- realaminos — beta launch discount code
-- Backs the new "20% OFF — Beta Launch" banner (see PromoBanner.tsx) with
-- a real, working code so the claim on the banner actually does something
-- at checkout. Safe to re-run — on conflict does nothing if it already
-- exists. Manage/deactivate/delete it anytime from /admin/discounts same
-- as any other code; nothing about the banner itself depends on this row
-- existing (it's just static text), so turning the code off doesn't
-- change what the banner says — remove PromoBanner from layout.tsx (or
-- deactivate the code and update the banner copy) once the beta period
-- ends.

insert into public.discount_codes (code, percent_off, is_active)
values ('BETA20', 20, true)
on conflict (code) do nothing;
