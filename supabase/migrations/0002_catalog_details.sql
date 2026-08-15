-- realaminos — catalog details (run this AFTER 0001_init.sql)
-- Adds product descriptions and per-size pricing (product_variants), and
-- seeds both to match the website prototype's launch lineup and copy.

alter table public.products add column if not exists description text;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text not null,
  price numeric(10, 2) not null,
  sort_order int not null default 0
);

alter table public.product_variants enable row level security;

-- Public read, same as products — anyone browsing the store needs prices.
create policy "product_variants_select_all" on public.product_variants
  for select using (true);

-- Only admins can add/edit/remove sizes and prices.
create policy "product_variants_write_admin" on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Descriptions (kept strictly research/mechanism-focused — no outcome
-- or benefit language, matching the RUO policy).
-- ---------------------------------------------------------------
update public.products set description =
  'A synthetic pentadecapeptide derived from a fragment of body protection compound, studied in vitro and in animal models for its interactions with angiogenesis-related signaling pathways.'
  where name = 'BPC-157';
update public.products set description =
  'A synthetic fragment of Thymosin Beta-4, studied in laboratory settings for its role in actin regulation and cell migration.'
  where name = 'TB-500';
update public.products set description =
  'A naturally occurring copper-binding tripeptide studied in vitro for its interactions with copper-transport signaling pathways.'
  where name = 'GHK-Cu';
update public.products set description =
  'A synthetic growth-hormone-releasing hormone (GHRH) analog used in laboratory studies of the GH/IGF-1 signaling axis.'
  where name = 'CJC-1295 (no DAC)';
update public.products set description =
  'A selective growth-hormone secretagogue peptide used in research on ghrelin-receptor-mediated GH release.'
  where name = 'Ipamorelin';
update public.products set description =
  'A synthetic GHRH analog used in laboratory research on growth-hormone axis signaling pathways.'
  where name = 'Tesamorelin';
update public.products set description =
  'A GLP-1 receptor agonist compound studied in laboratory and preclinical models of glucose-regulation signaling pathways.'
  where name = 'Semaglutide';
update public.products set description =
  'A triple GIP/GLP-1/glucagon receptor agonist compound used in laboratory research on multi-hormone signaling pathways.'
  where name = 'Retatrutide';
update public.products set description =
  'A synthetic heptapeptide studied in laboratory models for its interactions with neuroimmune signaling pathways.'
  where name = 'Selank';
update public.products set description =
  'A synthetic heptapeptide derived from ACTH(4-10), studied in laboratory settings for its interactions with neurotrophic signaling pathways.'
  where name = 'Semax';
update public.products set description =
  'A synthetic analog of alpha-melanocyte-stimulating hormone used in laboratory research on melanocortin receptor activity.'
  where name = 'MT-2 (Melanotan II)';
update public.products set description =
  'Bacteriostatic water used in laboratory settings to reconstitute lyophilized peptide compounds prior to in-vitro use.'
  where name = 'BAC Water';

-- ---------------------------------------------------------------
-- Sizes and prices. These are the same illustrative sample prices from
-- the prototype — replace with your real pricing whenever you're ready
-- (just update the product_variants table, no code changes needed).
-- ---------------------------------------------------------------
insert into public.product_variants (product_id, size, price, sort_order) values
  ((select id from public.products where name = 'BPC-157'), '5mg', 54.99, 1),
  ((select id from public.products where name = 'BPC-157'), '10mg', 94.99, 2),
  ((select id from public.products where name = 'BPC-157'), '20mg', 159.99, 3),

  ((select id from public.products where name = 'TB-500'), '5mg', 64.99, 1),
  ((select id from public.products where name = 'TB-500'), '10mg', 109.99, 2),
  ((select id from public.products where name = 'TB-500'), '20mg', 189.99, 3),

  ((select id from public.products where name = 'GHK-Cu'), '50mg', 49.99, 1),
  ((select id from public.products where name = 'GHK-Cu'), '100mg', 79.99, 2),

  ((select id from public.products where name = 'CJC-1295 (no DAC)'), '5mg', 59.99, 1),
  ((select id from public.products where name = 'CJC-1295 (no DAC)'), '10mg', 99.99, 2),

  ((select id from public.products where name = 'Ipamorelin'), '5mg', 54.99, 1),
  ((select id from public.products where name = 'Ipamorelin'), '10mg', 89.99, 2),

  ((select id from public.products where name = 'Tesamorelin'), '5mg', 129.99, 1),
  ((select id from public.products where name = 'Tesamorelin'), '10mg', 229.99, 2),

  ((select id from public.products where name = 'Semaglutide'), '5mg', 189.99, 1),
  ((select id from public.products where name = 'Semaglutide'), '10mg', 299.99, 2),

  ((select id from public.products where name = 'Retatrutide'), '10mg', 279.99, 1),
  ((select id from public.products where name = 'Retatrutide'), '20mg', 459.99, 2),

  ((select id from public.products where name = 'Selank'), '10mg', 69.99, 1),
  ((select id from public.products where name = 'Selank'), '30mg', 149.99, 2),

  ((select id from public.products where name = 'Semax'), '10mg', 69.99, 1),
  ((select id from public.products where name = 'Semax'), '30mg', 149.99, 2),

  ((select id from public.products where name = 'MT-2 (Melanotan II)'), '5mg', 44.99, 1),
  ((select id from public.products where name = 'MT-2 (Melanotan II)'), '10mg', 74.99, 2),

  ((select id from public.products where name = 'BAC Water'), '3mL', 14.99, 1),
  ((select id from public.products where name = 'BAC Water'), '10mL', 21.99, 2);
