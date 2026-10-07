import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";
import ProductCard from "@/components/ProductCard";
import { BULK_TIERS } from "@/lib/promotions/bulkPricing";

// Server Component: reads the real product catalog straight from Postgres.
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

  // Quantity-discount strip — read straight from the same BULK_TIERS the
  // product page, cart and checkout use, so it can never drift from what
  // is actually charged.
  const tierCells = BULK_TIERS.map((t, i) => {
    const next = BULK_TIERS[i + 1];
    const label = next
      ? next.minQty - 1 === t.minQty
        ? `Buy ${t.minQty}`
        : `Buy ${t.minQty}–${next.minQty - 1}`
      : `Buy ${t.minQty}+`;
    return { label, off: `${t.percentOff}% off` };
  });

  return (
    <>
      <main className="site-main">
        <div className="shop-hero">
          <div className="hx-pill">
            <i /> {all.length} compounds &nbsp;·&nbsp; &gt;99% purity
          </div>
          <h1 className="shop-title">
            Shop research <em>compounds</em>
          </h1>
          <p className="hx-lead">
            All compounds are &gt;99% purity, independently tested, and sold for laboratory
            research use only.
          </p>
        </div>

        <div className="chip-row">
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

        <div className="bulk-strip">
          <div>
            <small>Buy any 1</small>
            <b>Full price</b>
          </div>
          {tierCells.map((t) => (
            <div key={t.label}>
              <small>{t.label}</small>
              <b>{t.off}</b>
            </div>
          ))}
        </div>

        <div className="shop-count">
          Showing {visible.length} {visible.length === 1 ? "compound" : "compounds"}
        </div>

        <div className="product-grid shop-grid">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>
    </>
  );
}
