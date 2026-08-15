import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";
import ProductCard from "@/components/ProductCard";

// Server Component: reads the real product catalog straight from Postgres.
// Anyone can view this (products_select_all / product_variants_select_all
// policies allow public read) — no login required just to browse.
// Category filtering happens via a URL query param (?category=...) so the
// whole page stays server-rendered — no client JS needed just to filter.
export default async function ShopPage({ searchParams }: { searchParams: { category?: string } }) {
  const supabase = createClient();
  const activeCategory = searchParams.category ?? null;

  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("is_active", true)
    .order("category")
    .returns<ProductWithVariants[]>();

  if (error) {
    return (
      <main className="site-main">
        <div className="wrap">
          <h1>Shop</h1>
          <p className="error">Could not load products: {error.message}</p>
        </div>
      </main>
    );
  }

  const all = products ?? [];
  const categories = [...new Set(all.map((p) => p.category))];
  const visible = activeCategory ? all.filter((p) => p.category === activeCategory) : all;

  return (
    <main className="site-main">
      <div style={{ paddingTop: 36 }}>
        <h1 style={{ fontSize: 30, margin: "0 0 6px" }}>Shop Research Compounds</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          All compounds are &gt;99% purity, independently tested, and sold for laboratory
          research use only.
        </p>
      </div>

      <div className="shop-layout">
        <div className="filter-panel">
          <h5>Category</h5>
          <Link href="/shop" className={`filter-item ${!activeCategory ? "active" : ""}`}>
            All Products
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/shop?category=${encodeURIComponent(c)}`}
              className={`filter-item ${activeCategory === c ? "active" : ""}`}
            >
              {c}
            </Link>
          ))}
          <h5 style={{ marginTop: 26 }}>Purity</h5>
          <div className="filter-item active">&gt;99% (all products)</div>
        </div>

        <div>
          <div className="filter-row">
            <Link href="/shop" className={`chip ${!activeCategory ? "active" : ""}`}>
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c}
                href={`/shop?category=${encodeURIComponent(c)}`}
                className={`chip ${activeCategory === c ? "active" : ""}`}
              >
                {c}
              </Link>
            ))}
          </div>
          <div className="product-grid">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
