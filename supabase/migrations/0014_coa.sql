-- realaminos — Certificates of Analysis
-- Adds real COA data to the product catalog: the lot currently in stock for
-- each compound, its third-party test results, a link to the actual signed
-- PDF (served from /public/coa), and a preview image of page 1 (served from
-- /public/coa/preview — used as the second slide on the product page and in
-- the /lab product picker). This replaces the placeholder/demo copy in
-- src/app/lab/CoaLookup.tsx and the generic "available on request" line on
-- the product detail page.
--
-- Lot numbers match what's printed on the physical vial labels (see the
-- RealAminos label artwork — RA-26001 through RA-26011). BAC Water is not a
-- tested peptide batch, so it has no lot/COA and is left null.
--
-- Source: Certificates of Analysis from Freedom Diagnostics Testing,
-- accession #s 2608260651–2608260661, received 8/26/2026, reported
-- 8/30/2026, client Real Aminos LLC.

alter table public.products add column if not exists lot_number text;
alter table public.products add column if not exists coa_url text;
alter table public.products add column if not exists coa_preview_url text;
alter table public.products add column if not exists coa_purity_percent numeric(5, 2);
alter table public.products add column if not exists coa_net_content_mg numeric(8, 2);
alter table public.products add column if not exists coa_tested_at date;

-- Safety net: an earlier run of this file (before this fix) mistakenly put
-- the RA-26004 COA on "CJC-1295 (no DAC)" instead of "CJC-1295 (with DAC)"
-- — the tested lot is the with-DAC compound. Clear it off the wrong product
-- first so re-running this file also repairs a database that already has
-- the mistake, not just a fresh one.
update public.products set
  lot_number = null, coa_url = null, coa_preview_url = null, coa_purity_percent = null,
  coa_net_content_mg = null, coa_tested_at = null
  where name = 'CJC-1295 (no DAC)';

update public.products set
  lot_number = 'RA-26001', coa_url = '/coa/ra-26001.pdf', coa_preview_url = '/coa/preview/ra-26001.jpg',
  coa_purity_percent = 99.18, coa_net_content_mg = 11.98, coa_tested_at = '2026-08-30'
  where name = 'BPC-157';

update public.products set
  lot_number = 'RA-26002', coa_url = '/coa/ra-26002.pdf', coa_preview_url = '/coa/preview/ra-26002.jpg',
  coa_purity_percent = 99.55, coa_net_content_mg = 12.38, coa_tested_at = '2026-08-30'
  where name = 'TB-500';

update public.products set
  lot_number = 'RA-26003', coa_url = '/coa/ra-26003.pdf', coa_preview_url = '/coa/preview/ra-26003.jpg',
  coa_purity_percent = 99.96, coa_net_content_mg = 108.50, coa_tested_at = '2026-08-30'
  where name = 'GHK-Cu';

update public.products set
  lot_number = 'RA-26004', coa_url = '/coa/ra-26004.pdf', coa_preview_url = '/coa/preview/ra-26004.jpg',
  coa_purity_percent = 99.87, coa_net_content_mg = 5.84, coa_tested_at = '2026-08-30'
  where name = 'CJC-1295 (with DAC)';

update public.products set
  lot_number = 'RA-26005', coa_url = '/coa/ra-26005.pdf', coa_preview_url = '/coa/preview/ra-26005.jpg',
  coa_purity_percent = 99.58, coa_net_content_mg = 4.57, coa_tested_at = '2026-08-30'
  where name = 'Ipamorelin';

update public.products set
  lot_number = 'RA-26006', coa_url = '/coa/ra-26006.pdf', coa_preview_url = '/coa/preview/ra-26006.jpg',
  coa_purity_percent = 99.67, coa_net_content_mg = 9.48, coa_tested_at = '2026-08-30'
  where name = 'MT-2 (Melanotan II)';

update public.products set
  lot_number = 'RA-26007', coa_url = '/coa/ra-26007.pdf', coa_preview_url = '/coa/preview/ra-26007.jpg',
  coa_purity_percent = 99.96, coa_net_content_mg = 11.05, coa_tested_at = '2026-08-30'
  where name = 'Selank';

update public.products set
  lot_number = 'RA-26008', coa_url = '/coa/ra-26008.pdf', coa_preview_url = '/coa/preview/ra-26008.jpg',
  coa_purity_percent = 99.60, coa_net_content_mg = 11.69, coa_tested_at = '2026-08-30'
  where name = 'Semax';

update public.products set
  lot_number = 'RA-26009', coa_url = '/coa/ra-26009.pdf', coa_preview_url = '/coa/preview/ra-26009.jpg',
  coa_purity_percent = 99.94, coa_net_content_mg = 11.80, coa_tested_at = '2026-08-30'
  where name = 'Semaglutide';

update public.products set
  lot_number = 'RA-26010', coa_url = '/coa/ra-26010.pdf', coa_preview_url = '/coa/preview/ra-26010.jpg',
  coa_purity_percent = 99.13, coa_net_content_mg = 9.21, coa_tested_at = '2026-08-30'
  where name = 'Tesamorelin';

update public.products set
  lot_number = 'RA-26011', coa_url = '/coa/ra-26011.pdf', coa_preview_url = '/coa/preview/ra-26011.jpg',
  coa_purity_percent = 99.69, coa_net_content_mg = 11.75, coa_tested_at = '2026-08-30'
  where name = 'Retatrutide';
