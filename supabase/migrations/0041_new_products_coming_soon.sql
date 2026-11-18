-- RealAminos — add six "coming soon" listings (run in the Supabase SQL Editor after 0040)
--
-- Adds: GLOW 70mg, KLOW 80mg, MOTS-c 10mg, CJC-1295 (no DAC) 5mg,
-- BPC-157 + TB-500 "Wolverine Blend" 10mg, and a 20mg size on the existing
-- GLP-3 (RT) product (with its own vial photo that swaps in when the 20mg
-- size is selected on the product page).
--
-- Every one of them is inserted with stock = 0, so the storefront shows
-- "Out of Stock — Coming Soon" and cannot add them to a cart. Each also gets
-- a restock_eta two weeks from the day you run this; the site turns that into
-- "ETA 2 weeks" and quietly drops the label once the date passes. When real
-- units arrive, set the stock at /admin/inventory — nothing else to change.
--
-- Safe to run more than once, and safe if one of these products already
-- exists (it is updated in place instead of duplicated).

alter table public.product_variants add column if not exists restock_eta date;
alter table public.product_variants add column if not exists image_url text;

comment on column public.product_variants.restock_eta is
  'Optional expected restock date. While the size is out of stock and this date is still in the future, the storefront shows "ETA N weeks".';
comment on column public.product_variants.image_url is
  'Optional vial photo for this exact size. When set, the product page swaps to it as soon as the size is selected; NULL falls back to the product photo.';

do $$
declare
  spec record;
  pid uuid;
begin
  for spec in
    select * from (values
      ('GLOW', 'Peptide Blends', '/products/glow.jpg', '70mg', 69.99::numeric,
       'A multi-peptide research blend supplied as a single 70 mg lyophilized vial for laboratory use. Each lot is independently third-party tested, with a lot-specific Certificate of Analysis.'),
      ('KLOW', 'Peptide Blends', '/products/klow.jpg', '80mg', 89.99::numeric,
       'A multi-peptide research blend supplied as a single 80 mg lyophilized vial for laboratory use. Each lot is independently third-party tested, with a lot-specific Certificate of Analysis.'),
      ('BPC-157 + TB-500 (Wolverine Blend)', 'Peptide Blends', '/products/bpc-157-tb-500.jpg', '10mg', 89.99::numeric,
       'A research blend of two synthetic peptides, BPC-157 and TB-500, supplied as a single 10 mg lyophilized vial. BPC-157 is studied in vitro and in animal models for its interactions with angiogenesis-related signaling pathways; TB-500 is a synthetic fragment of Thymosin Beta-4 studied in laboratory settings for its role in actin regulation and cell migration.'),
      ('MOTS-c', 'Mitochondrial Peptides', '/products/mots-c.jpg', '10mg', 49.99::numeric,
       'A mitochondrial-derived peptide studied in laboratory models for its interactions with cellular metabolic signaling pathways.'),
      ('CJC-1295 (no DAC)', 'GHRH / Secretagogue Peptides', '/products/cjc-1295-no-dac.jpg', '5mg', 39.99::numeric,
       'A synthetic growth-hormone-releasing hormone (GHRH) analog used in laboratory studies of the GH/IGF-1 signaling axis.')
    ) as t(name, category, image_url, size, price, description)
  loop
    select id into pid from public.products where name = spec.name order by created_at limit 1;

    if pid is null then
      insert into public.products (name, category, image_url, description, is_active)
      values (spec.name, spec.category, spec.image_url, spec.description, true)
      returning id into pid;
    else
      update public.products
        set category = spec.category,
            image_url = spec.image_url,
            description = spec.description,
            is_active = true
        where id = pid;
    end if;

    if exists (select 1 from public.product_variants where product_id = pid and size = spec.size) then
      update public.product_variants
        set price = spec.price, stock = 0, restock_eta = current_date + 14
        where product_id = pid and size = spec.size;
    else
      insert into public.product_variants (product_id, size, price, sort_order, stock, restock_eta)
      values (pid, spec.size, spec.price, 1, 0, current_date + 14);
    end if;
  end loop;
end $$;

-- GLP-3 (RT): add / update the 20mg size on the existing product.
do $$
declare
  pid uuid;
begin
  select id into pid from public.products
    where name in ('GLP-3 (RT)', 'GLP3 (RT)', 'Retatrutide')
    order by created_at limit 1;

  if pid is null then
    raise exception 'GLP-3 (RT) product not found — nothing was changed for the 20mg size';
  end if;

  if exists (select 1 from public.product_variants where product_id = pid and size = '20mg') then
    update public.product_variants
      set price = 119.99, compare_at_price = null, stock = 0,
          restock_eta = current_date + 14, image_url = '/products/glp-3-rt-20mg.jpg'
      where product_id = pid and size = '20mg';
  else
    insert into public.product_variants (product_id, size, price, sort_order, stock, restock_eta, image_url)
    values (pid, '20mg', 119.99,
            coalesce((select max(sort_order) from public.product_variants where product_id = pid), 0) + 1,
            0, current_date + 14, '/products/glp-3-rt-20mg.jpg');
  end if;
end $$;

-- Check the result — you should see one row per size below, all with stock 0
-- (except any GLP-3 (RT) 10mg stock you already had), and no duplicate names:
select p.name, p.category, v.size, v.price, v.stock, v.restock_eta, v.image_url
from public.products p
join public.product_variants v on v.product_id = p.id
where p.name in ('GLOW', 'KLOW', 'MOTS-c', 'CJC-1295 (no DAC)', 'BPC-157 + TB-500 (Wolverine Blend)',
                 'GLP-3 (RT)', 'GLP3 (RT)', 'Retatrutide')
order by p.name, v.sort_order;
