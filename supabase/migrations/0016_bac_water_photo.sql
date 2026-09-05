-- realaminos — BAC Water cover photo
-- The one launch product that didn't have a real vial photo yet (see the
-- note left in 0015_product_images_and_catalog_admin.sql and Section 6 of
-- the build plan) now does. Photo committed at /public/products/bac-water.jpg.

update public.products set image_url = '/products/bac-water.jpg' where name = 'BAC Water';
