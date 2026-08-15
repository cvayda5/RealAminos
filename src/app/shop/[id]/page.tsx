import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";
import AddToCartBox from "./AddToCartBox";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("id", params.id)
    .single<ProductWithVariants>();

  if (!product) notFound();

  const sortedVariants = [...product.product_variants].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <main className="site-main">
      <div className="breadcrumb">
        <Link href="/shop">Shop</Link> / <span>{product.category}</span> / <span>{product.name}</span>
      </div>

      <div className="pd-layout">
        <div className="pd-visual">
          <div className="cap-lg" />
          <div className="vial-lg" />
        </div>

        <div>
          <div className="pd-cat">{product.category}</div>
          <h1 className="pd-title">{product.name}</h1>
          {product.cas_number && <div className="pd-cas">CAS {product.cas_number}</div>}
          <div className="pd-purity">✓ &gt;99% Purity — Independently Verified</div>

          <AddToCartBox product={{ ...product, product_variants: sortedVariants }} />

          <div className="pd-disclaimer">
            <strong>Research Use Only.</strong> This product is sold strictly for laboratory
            research use by qualified professionals. It is not a drug, food, dietary
            supplement, or cosmetic; it is not for human or animal consumption, injection, or
            use of any kind; and it is not for diagnostic use. Not evaluated by the FDA for
            safety or efficacy.
          </div>

          <div className="pd-desc">
            <h4>Compound Overview</h4>
            <p>{product.description}</p>
            <h4>Specifications</h4>
            <table className="spec-table">
              <tbody>
                <tr>
                  <td>CAS Number</td>
                  <td>{product.cas_number ?? "—"}</td>
                </tr>
                <tr>
                  <td>Purity</td>
                  <td>&gt;99% (HPLC verified)</td>
                </tr>
                <tr>
                  <td>Category</td>
                  <td>{product.category}</td>
                </tr>
                <tr>
                  <td>Form</td>
                  <td>Lyophilized powder, sealed vial</td>
                </tr>
                <tr>
                  <td>Storage</td>
                  <td>Store lyophilized product at -20°C; use appropriate laboratory handling</td>
                </tr>
                <tr>
                  <td>Intended Use</td>
                  <td>Laboratory research use only</td>
                </tr>
              </tbody>
            </table>
            <h4>Certificate of Analysis</h4>
            <p>
              A lot-specific COA (HPLC purity, mass spec identity confirmation, and endotoxin
              screening) is generated for every batch and available on request or via our{" "}
              <Link href="/lab" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>
                Lab Testing lookup
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
