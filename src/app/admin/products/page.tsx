import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";
import CreateProductForm from "./CreateProductForm";
import ProductRow from "./ProductRow";

export default async function AdminProductsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/products");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal catalog management — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  // Public read policy (products_select_all / product_variants_select_all)
  // means the caller's own session already sees everything here — same
  // reasoning as /admin/inventory.
  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .order("category")
    .order("name")
    .returns<ProductWithVariants[]>();

  const categories = Array.from(new Set((products ?? []).map((p) => p.category))).sort();

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Products</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 620 }}>
              Add new compounds to the catalog with a starting size, price, and cover photo, edit
              a product&apos;s photo/category/lot number/description/price right here, or remove
              one that&apos;s no longer sold. Deleting a product doesn&apos;t change any past
              order — those keep their own record of what was bought regardless. Adding an
              additional size to a product, and stock counts, are still managed on the Inventory
              page.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/orders" className="btn btn-outline">
              Back to Orders
            </Link>
            <Link href="/admin/discounts" className="btn btn-outline">
              Discount Codes
            </Link>
            <Link href="/admin/affiliates" className="btn btn-outline">
              Affiliate Sales
            </Link>
            <Link href="/admin/affiliate-signups" className="btn btn-outline">
              Affiliate Signups
            </Link>
            <Link href="/admin/reports" className="btn btn-outline">
              Revenue Reports
            </Link>
            <Link href="/admin/points" className="btn btn-outline">
              Points Program
            </Link>
            <Link href="/admin/staff" className="btn btn-outline">
              Manage Staff
            </Link>
            <Link href="/admin/inventory" className="btn btn-outline">
              Inventory
            </Link>
          </div>
        </div>

        <div className="card">
          <strong>Add a new product</strong>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Starts with one size and price — add more sizes for it on the Inventory page
            afterward if it comes in more than one.
          </p>
          <CreateProductForm categories={categories} />
        </div>

        {error && <p className="error">{error.message}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Product</th>
                <th>Category</th>
                <th>Lot #</th>
                <th>Description</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products?.map((product) => (
                <ProductRow key={product.id} product={product} categories={categories} />
              ))}
            </tbody>
          </table>
          {products?.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No products yet — add one above.</p>
          )}
        </div>
      </div>
    </main>
  );
}
