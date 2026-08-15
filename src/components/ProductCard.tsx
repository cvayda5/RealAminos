import Link from "next/link";
import type { ProductWithVariants } from "@/types/database";

export default function ProductCard({ product }: { product: ProductWithVariants }) {
  const lowPrice = Math.min(...product.product_variants.map((v) => v.price));

  return (
    <div className="pcard">
      <Link href={`/shop/${product.id}`} className="thumb">
        <span className="badge-purity">&gt;99%</span>
        <div className="cap" />
        <div className="vial" />
      </Link>
      <div className="body">
        <div className="cat">{product.category}</div>
        <Link href={`/shop/${product.id}`}>
          <h3>{product.name}</h3>
        </Link>
        {product.cas_number && <div className="cas">CAS {product.cas_number}</div>}
        <div className="row-bottom">
          <div className="price">
            ${lowPrice.toFixed(2)} <small>from</small>
          </div>
          <Link href={`/shop/${product.id}`} className="btn-add">
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
