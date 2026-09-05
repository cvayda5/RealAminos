import Link from "next/link";
import type { ProductWithVariants } from "@/types/database";

export default function ProductCard({ product }: { product: ProductWithVariants }) {
  const inStock = product.product_variants.filter((v) => v.stock > 0);
  const comingSoon = inStock.length === 0;
  // Price "from" the cheapest size that's actually buyable — falls back to
  // the cheapest size overall only when nothing at all is in stock, purely
  // so the card still shows a plausible number under the "Coming Soon" label.
  const priceFrom = (inStock.length > 0 ? inStock : product.product_variants).reduce(
    (min, v) => Math.min(min, v.price),
    Infinity
  );

  return (
    <div className="pcard">
      <Link href={`/shop/${product.id}`} className="thumb">
        <span className="badge-purity">&gt;99%</span>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="thumb-photo" />
        ) : (
          <>
            <div className="cap" />
            <div className="vial" />
          </>
        )}
      </Link>
      <div className="body">
        <div className="cat">{product.category}</div>
        <Link href={`/shop/${product.id}`}>
          <h3>{product.name}</h3>
        </Link>
        {product.cas_number && <div className="cas">CAS {product.cas_number}</div>}
        <div className="row-bottom">
          {comingSoon ? (
            <div className="price" style={{ color: "var(--muted)" }}>
              Coming Soon
            </div>
          ) : (
            <div className="price">
              ${priceFrom.toFixed(2)} <small>from</small>
            </div>
          )}
          <Link href={`/shop/${product.id}`} className="btn-add">
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
