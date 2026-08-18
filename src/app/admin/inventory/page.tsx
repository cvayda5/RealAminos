import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";
import InventoryVariantRow from "./InventoryVariantRow";

export default async function InventoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/inventory");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal inventory management — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5, marginBottom: 18 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
          <div className="admin-note">
            Promote this account with a SQL command in README.md, then refresh this page.
          </div>
        </div>
      </main>
    );
  }

  // Public read policy (products_select_all / product_variants_select_all)
  // means the caller's own session already sees everything here — no need
  // for the service-role client just to list the catalog.
  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .order("category")
    .order("name")
    .returns<ProductWithVariants[]>();

  const rows = (products ?? []).flatMap((p) =>
    [...p.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ product: p, variant: v }))
  );

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Inventory</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 620 }}>
              Set how many units of each product+size are on hand. A size with 0 stock shows as
              &quot;Out of Stock — Coming Soon&quot; on the storefront and can&apos;t be bought or
              redeemed with points — no separate visibility toggle needed. Stock also drops
              automatically by itself every time a real order for that size is placed.
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
          </div>
        </div>

        {error && <p className="error">{error.message}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Size</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, variant }) => (
                <InventoryVariantRow key={variant.id} product={product} variant={variant} />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p style={{ color: "var(--muted)", padding: 16 }}>No products yet.</p>}
        </div>
      </div>
    </main>
  );
}
