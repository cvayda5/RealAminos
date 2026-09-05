# Applying this update

This zip contains the full `realaminos-live` repo with the changes below already made.
Since I don't have push access to your GitHub repo, apply it yourself with either option:

**Option A — locally with git:**
1. Unzip this over a fresh clone of your repo (or copy the changed files listed below into your existing clone).
2. `git add -A && git commit -m "Add real product photos and a staff products admin page"`
3. `git push`

**Option B — GitHub web upload:**
Upload the changed/new files listed below through GitHub's "Add file → Upload files" on your repo (drag in each path, preserving folders).

## Run the new migration

Open the Supabase dashboard's SQL Editor and run `supabase/migrations/0015_product_images_and_catalog_admin.sql`. It:
- Adds an `image_url` column to `products` and points it at the 11 real vial photos for your existing catalog (BAC Water is left photo-less on purpose — it'll just show the old placeholder mark until you add one).
- Creates a public `product-images` Storage bucket (with admin-only write policies) that the new admin page uploads new product photos into.

No new environment variables are needed — the admin upload route reuses `SUPABASE_SERVICE_ROLE_KEY`, which you already have set.

## What changed

**New real product photos** (committed straight into the repo, so no Storage/upload step needed for these 11):
- `public/products/bpc-157.jpg`, `tb-500.jpg`, `ghk-cu.jpg`, `cjc-1295-with-dac.jpg`, `ipamorelin.jpg`, `tesamorelin.jpg`, `semaglutide.jpg`, `retatrutide.jpg`, `selank.jpg`, `semax.jpg`, `mt-2.jpg`

**New migration:**
- `supabase/migrations/0015_product_images_and_catalog_admin.sql`

**Updated to render the real photo (falls back to the old CSS vial mark if a product has no photo):**
- `src/types/database.ts`
- `src/components/ProductCard.tsx` (shop grid)
- `src/app/shop/[id]/ProductVisualCarousel.tsx` + `src/app/shop/[id]/page.tsx` (product detail page)
- `src/app/points/RedeemProductGrid.tsx` (points redemption grid)
- `src/app/globals.css` (new `.thumb-photo` style)

**New staff admin feature — add & delete products:**
- `src/app/admin/products/page.tsx`, `CreateProductForm.tsx`, `ProductRow.tsx`
- `src/app/api/admin/products/route.ts` (list + create)
- `src/app/api/admin/products/[id]/route.ts` (edit description/category/photo + delete)
- A "Products" nav link was added to all the other admin pages' nav bars

### How the new admin page works
Go to `/admin/products` while signed in as staff. You can:
- **Add a product**: name, category, CAS number (optional), description (optional), one starting size + price, and a cover photo — all in one form. (Add more sizes for it afterward on `/admin/inventory`, same as everything else.)
- **Edit** a product's category, description, or photo inline in the table.
- **Delete** a product entirely (its sizes go with it; past orders are untouched since they store their own snapshot of what was bought).

Price and stock stay managed on the existing `/admin/inventory` page, same as before — this new page only adds the "create a whole new product" and "delete a product" pieces that didn't exist yet.

## Photo → product mapping used

Matched by reading the name printed on each vial's label:

| Photo file | Product |
|---|---|
| bpc-157.jpg | BPC-157 |
| tb-500.jpg | TB-500 |
| ghk-cu.jpg | GHK-Cu |
| cjc-1295-with-dac.jpg | CJC-1295 (with DAC) |
| ipamorelin.jpg | Ipamorelin |
| tesamorelin.jpg | Tesamorelin |
| semaglutide.jpg | Semaglutide |
| retatrutide.jpg | Retatrutide |
| selank.jpg | Selank |
| semax.jpg | Semax |
| mt-2.jpg | MT-2 (Melanotan II) |

BAC Water and "CJC-1295 (no DAC)" weren't in the 11 photos supplied, so they keep the old placeholder look until a photo is added for them (via the new admin page, or another migration).
