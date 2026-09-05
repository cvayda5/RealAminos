import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Same requireAdmin() pattern as every other /api/admin/* route (see
// discount-codes, inventory, staff): verify admin status using the
// caller's own RLS-backed session before touching anything with the
// service-role client.
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return {};
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

// Uploads an image into the public product-images Storage bucket and
// returns its public URL. Vercel's filesystem is read-only at runtime, so
// a photo uploaded through the website can't be written into /public the
// way the original 11 launch photos were committed straight into the repo
// — Storage is the one place a photo uploaded *after* deploy can actually
// live.
async function uploadProductImage(admin: ReturnType<typeof createAdminClient>, productId: string, file: File) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${productId}/cover-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("product-images")
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data } = admin.storage.from("product-images").getPublicUrl(path);
  return { url: data.publicUrl };
}

// GET /api/admin/products — every product with its variants, for the
// /admin/products table. (The page itself already fetches this the same
// way server-side; this GET exists so the client can refetch/refresh
// without a full page reload if needed.)
export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .order("category")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data });
}

// POST /api/admin/products — create a new product with one starting
// size/price and an optional cover photo. Additional sizes for the same
// product can be added directly in Supabase for now (see 0011_inventory.sql's
// doc comment on CJC-1295 (with DAC) for the same "no admin UI for this
// yet" note) — /admin/inventory then handles price/stock for whatever
// sizes exist.
export async function POST(request: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const casNumber = String(form.get("casNumber") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const size = String(form.get("size") ?? "").trim();
  const price = Number(form.get("price"));
  const image = form.get("image");

  if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
  if (!size) return NextResponse.json({ error: "Size is required." }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Price must be a positive number." }, { status: 400 });
  }
  if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be smaller than 8MB." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: product, error: insertError } = await admin
    .from("products")
    .insert({
      name,
      category,
      cas_number: casNumber || null,
      description: description || null,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: `A product named "${name}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  let imageWarning: string | null = null;
  if (image instanceof File && image.size > 0) {
    const result = await uploadProductImage(admin, product.id, image);
    if (result.error) {
      imageWarning = `Product created, but the photo failed to upload: ${result.error}`;
    } else if (result.url) {
      await admin.from("products").update({ image_url: result.url }).eq("id", product.id);
      product.image_url = result.url;
    }
  }

  const { data: variant, error: variantError } = await admin
    .from("product_variants")
    .insert({ product_id: product.id, size, price, sort_order: 1, stock: 0 })
    .select("*")
    .single();

  if (variantError) {
    // The product row exists but has no sizes — surface this clearly
    // rather than silently leaving an unbuyable product in the catalog.
    return NextResponse.json(
      { error: `Product created, but the size/price couldn't be saved: ${variantError.message}`, product },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { product: { ...product, product_variants: [variant] }, warning: imageWarning },
    { status: 201 }
  );
}
