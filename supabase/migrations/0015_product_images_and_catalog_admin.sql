-- realaminos — real product photos + catalog admin (add/delete products)
--
-- Two independent things bundled together because they both touch the
-- products table:
--
-- 1. `image_url` on products — this is the first real photo the storefront
--    has ever had (the shop grid and product page previously just drew a
--    generic CSS vial shape). For the 11 already-launched peptides this
--    points at the real vial photos committed to /public/products/*.jpg.
--    BAC Water has no photo yet and is left null on purpose — the
--    storefront falls back to the old CSS vial mark whenever image_url is
--    null, so nothing breaks for a product without a photo.
--
-- 2. A public Supabase Storage bucket for photos staff upload later from
--    the new /admin/products page (Vercel's filesystem is read-only at
--    runtime, so a photo uploaded through the website can't be written into
--    /public — it has to live somewhere like Storage instead). Reads are
--    public (customers need to see it); writes are restricted to admins,
--    mirroring products_write_admin below. In practice every write happens
--    through the service-role admin API route (which already checks
--    is_admin() itself — see src/app/api/admin/products/route.ts), so
--    these policies are a defense-in-depth backstop, not the only guard.

alter table public.products add column if not exists image_url text;

update public.products set image_url = '/products/bpc-157.jpg' where name = 'BPC-157';
update public.products set image_url = '/products/tb-500.jpg' where name = 'TB-500';
update public.products set image_url = '/products/ghk-cu.jpg' where name = 'GHK-Cu';
update public.products set image_url = '/products/cjc-1295-with-dac.jpg' where name = 'CJC-1295 (with DAC)';
update public.products set image_url = '/products/ipamorelin.jpg' where name = 'Ipamorelin';
update public.products set image_url = '/products/tesamorelin.jpg' where name = 'Tesamorelin';
update public.products set image_url = '/products/semaglutide.jpg' where name = 'Semaglutide';
update public.products set image_url = '/products/retatrutide.jpg' where name = 'Retatrutide';
update public.products set image_url = '/products/selank.jpg' where name = 'Selank';
update public.products set image_url = '/products/semax.jpg' where name = 'Semax';
update public.products set image_url = '/products/mt-2.jpg' where name = 'MT-2 (Melanotan II)';

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());
