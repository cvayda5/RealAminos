import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";
import ProductCard from "@/components/ProductCard";

export default async function Home() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Product data (name, image, price) now requires an account to view
  // anywhere on the site, including here — so a logged-out visitor never
  // has it fetched or rendered on the homepage either. See /shop and
  // /shop/[id] for the same gate on the actual catalog pages.
  const { data: products } = user
    ? await supabase
        .from("products")
        .select("*, product_variants(*)")
        .eq("is_active", true)
        .order("created_at")
        .limit(8)
        .returns<ProductWithVariants[]>()
    : { data: null };

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div>
            <div className="eyebrow">● Third-Party Tested &nbsp;|&nbsp; &gt;99% Purity</div>
            <h1>
              Research-grade peptides,
              <br />
              <em>verified</em> batch by batch.
            </h1>
            <p className="lead">
              RealAminos supplies high-purity peptide and small-molecule compounds to
              laboratories and qualified researchers, backed by independent Certificate of
              Analysis testing on every lot.
            </p>
            <div className="hero-ctas">
              <Link href="/shop" className="btn">
                Browse Research Compounds
              </Link>
              <Link href="/lab" className="btn-ghost btn">
                View COA Process
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <b>&gt;99%</b>
                <span>Avg. verified purity</span>
              </div>
              <div className="stat">
                <b>12+</b>
                <span>Compounds at launch</span>
              </div>
              <div className="stat">
                <b>3rd-Party</b>
                <span>Independent lab testing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="site-main">
        <section className="block">
          <div className="trust-grid">
            <div className="trust-card">
              <div className="ic">A</div>
              <h4>Analytical Testing</h4>
              <p>Every batch is verified by an independent third-party lab before it ships.</p>
            </div>
            <div className="trust-card">
              <div className="ic">R</div>
              <h4>Research Use Only</h4>
              <p>Sold exclusively for laboratory research — never marketed for human or animal use.</p>
            </div>
            <div className="trust-card">
              <div className="ic">S</div>
              <h4>Cold-Chain Shipping</h4>
              <p>Packaged to protect compound integrity from our facility to your lab.</p>
            </div>
            <div className="trust-card">
              <div className="ic">C</div>
              <h4>COA On Every Order</h4>
              <p>Look up or download the Certificate of Analysis for any lot number.</p>
            </div>
          </div>
        </section>

        <section className="block" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <div>
              <h2>Featured Research Compounds</h2>
              <p>A snapshot of our launch catalog — full list available in Shop.</p>
            </div>
            <Link href="/shop" className="viewall">
              View all products →
            </Link>
          </div>
          {user ? (
            <div className="product-grid">
              {products?.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
              <p style={{ margin: "0 0 16px", color: "var(--muted)" }}>
                Create a free account to view our research compound catalog, pricing, and
                Certificates of Analysis.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/signup" className="btn">
                  Create Account
                </Link>
                <Link href="/login" className="btn-ghost btn">
                  Log In
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="block" style={{ paddingTop: 0 }}>
          <div className="ruo-banner">
            <div className="ic">⚠</div>
            <div>
              <h4>Research Use Only — Please Read</h4>
              <p>
                All products sold by RealAminos are intended strictly for in-vitro laboratory
                research by qualified professionals and institutions. They are not drugs,
                foods, dietary supplements, or cosmetics; they are not for human or animal
                consumption, injection, or any other use; and they are not for diagnostic use.
                See our <Link href="/ruo-policy" style={{ textDecoration: "underline" }}>RUO Policy</Link> for full terms.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
