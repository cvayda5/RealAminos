-- Renames the two GLP-1 class products to match the new vial label
-- artwork/branding — "Semaglutide" -> "GLP-1 (SG)" and "Retatrutide" ->
-- "GLP-3 (RT)". This is a pure text rename on public.products.name: every
-- page that shows a product's name (shop grid, product detail, the /lab
-- COA lookup picker, admin) reads it live from this column, so nothing
-- else needs to change to pick this up.
--
-- Deliberately NOT touching image_url — the new vial photos were dropped in
-- at the exact same file paths (/products/semaglutide.jpg,
-- /products/retatrutide.jpg) rather than being renamed, so the existing
-- image_url values are still correct.
--
-- Also deliberately NOT touching order_items.product_name on existing
-- orders — that column is a snapshot of the name at checkout time (see
-- 0001_init.sql), and past orders should keep showing whatever name the
-- customer actually saw and paid for, not get silently rewritten.
update public.products set name = 'GLP-1 (SG)' where name = 'Semaglutide';
update public.products set name = 'GLP-3 (RT)' where name = 'Retatrutide';
