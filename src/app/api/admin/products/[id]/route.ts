import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// PATCH /api/admin/products/[id] — edit a product's description and/or
// replace its cover photo. Price and stock stay on /admin/inventory (they
// live on product_variants, not products, and that page already handles
// them per-size) — this route only ever touches the products row itself.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const form = await request.formData();
  const admin = createAdminClient();

  const updates: Record<string, unknown> = {};

  if (form.has("description")) {
    const description = String(form.get("description") ?? "").trim();
    updates.description = description || null;
  }
  if (form.has("category")) {
    const category = String(form.get("category") ?? "").trim();
    if (!category) {
      return NextResponse.json({ error: "Category can't be empty." }, { status: 400 });
    }
    updates.category = category;
  }
  if (form.has("casNumber")) {
    const casNumber = String(form.get("casNumber") ?? "").trim();
    updates.cas_number = casNumber || null;
  }

  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be smaller than 8MB." }, { status: 400 });
    }
    const ext = (image.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${params.id}/cover-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await image.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, bytes, { contentType: image.type || "image/jpeg", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: `Photo upload failed: ${uploadError.message}` }, { status: 500 });
    }
    const { data } = admin.storage.from("product-images").getPublicUrl(path);
    updates.image_url = data.publicUrl;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("products")
    .update(updates)
    .eq("id", params.id)
    .select("*, product_variants(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

// DELETE /api/admin/products/[id] — permanently remove a product (and,
// via the products_variants FK's on-delete-cascade, all of its sizes).
// Past orders are unaffected: order_items stores its own product_name/size
// snapshot rather than a live join, so a deleted product doesn't change
// anything about an order already placed (same reasoning as deleting a
// discount code).
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const admin = createAdminClient();

  // Best-effort cleanup of any uploaded photo(s) in Storage — failing to
  // find/delete one here should never block the product delete itself.
  const { data: files } = await admin.storage.from("product-images").list(params.id);
  if (files && files.length > 0) {
    await admin.storage.from("product-images").remove(files.map((f) => `${params.id}/${f.name}`));
  }

  const { error } = await admin.from("products").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
