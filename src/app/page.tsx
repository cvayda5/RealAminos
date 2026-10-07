import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";
import ProductCard from "@/components/ProductCard";

// Illustrative HPLC-style trace drawn in the "Analytical Testing" card —
// decorative only (labelled as such on the page), not real lot data.
const TRACE_PATH =
  "M0,99.4 L3,99.4 L6,99.4 L9,99.4 L12,99.4 L15,99.4 L18,99.4 L21,99.4 L24,99.4 L27,99.4 L30,99.4 L33,99.4 L36,99.4 L39,99.4 L42,99.4 L45,99.4 L48,99.4 L51,99.4 L54,99.4 L57,99.4 L60,99.4 L63,99.4 L66,99.4 L69,99.4 L72,99.4 L75,99.4 L78,99.4 L81,99.4 L84,99.4 L87,99.4 L90,99.4 L93,99.4 L96,99.4 L99,99.4 L102,99.4 L105,99.4 L108,99.4 L111,99.4 L114,99.4 L117,99.2 L120,98.4 L123,96.4 L126,95.1 L129,96.4 L132,98.4 L135,99.2 L138,99.4 L141,99.4 L144,99.4 L147,99.4 L150,99.4 L153,99.4 L156,99.4 L159,99.4 L162,99.4 L165,99.4 L168,99.4 L171,99.4 L174,99.4 L177,99.4 L180,99.4 L183,99.4 L186,99.4 L189,99.4 L192,99.4 L195,99.3 L198,98.8 L201,97.1 L204,92.4 L207,82.2 L210,64.8 L213,43.2 L216,25.5 L219,20.6 L222,31.4 L225,51.9 L228,72.5 L231,87.1 L234,94.8 L237,98.0 L240,99.1 L243,99.4 L246,99.4 L249,99.4 L252,99.4 L255,99.4 L258,99.4 L261,99.4 L264,99.4 L267,99.4 L270,99.4 L273,99.4 L276,99.4 L279,99.4 L282,99.4 L285,99.4 L288,99.2 L291,98.6 L294,97.5 L297,96.5 L300,96.6 L303,97.7 L306,98.8 L309,99.3 L312,99.4 L315,99.4 L318,99.4 L321,99.4 L324,99.4 L327,99.4 L330,99.4 L333,99.4 L336,99.4 L339,99.4 L342,99.4 L345,99.4 L348,99.4 L351,99.4 L354,99.3 L357,98.8 L360,97.8 L363,98.0 L366,99.0 L369,99.4 L372,99.4 L375,99.4 L378,99.4 L381,99.4 L384,99.4 L387,99.4 L390,99.4 L393,99.4 L396,99.4 L399,99.4 L402,99.4 L405,99.4 L408,99.4 L411,99.4 L414,99.4 L417,99.4 L420,99.4";

export default async function Home() {
  const supabase = createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("is_active", true)
    .order("created_at")
    .limit(8)
    .returns<ProductWithVariants[]>();

  // Hero photo fan: up to five of the real product photos, arranged so the
  // first product with a photo sits in the middle (c0) and the rest fan
  // outward (c1/c2 closer in, c3/c4 at the edges).
  const withPhotos = (products ?? []).filter((p) => p.image_url).slice(0, 5);
  const fanOrder = [3, 1, 0, 2, 4].filter((i) => i < withPhotos.length);

  return (
    <div className="dark-page">
      <section className="hx">
        <div className="hx-pill">
          <i /> Third-Party Tested &nbsp;·&nbsp; &gt;99% Purity
        </div>
        <h1 className="hx-title">
          Research-grade peptides, <em>verified</em> batch by batch.
        </h1>
        <p className="hx-lead">
          RealAminos supplies high-purity peptide and small-molecule compounds to
          laboratories and qualified researchers, backed by independent Certificate of
          Analysis testing on every lot.
        </p>
        <div className="hx-ctas">
          <Link href="/shop" className="btn">
            Browse Research Compounds →
          </Link>
          <Link href="/lab" className="btn btn-ghost">
            View COA Process
          </Link>
        </div>

        {withPhotos.length > 0 && (
          <div className="hx-fan" aria-label="Featured research compounds">
            <div className="hx-fan-glow" />
            {fanOrder.map((i) => {
              const p = withPhotos[i];
              return (
                <Link key={p.id} href={`/shop/${p.id}`} className={`fan-tile c${i === 0 ? 0 : i}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url!} alt={p.name} />
                </Link>
              );
            })}
          </div>
        )}

        <div className="hx-stats">
          <div className="hx-stat">
            <b>&gt;99%</b>
            <span>Avg. verified purity</span>
          </div>
          <div className="hx-stat">
            <b>12+</b>
            <span>Compounds at launch</span>
          </div>
          <div className="hx-stat">
            <b>3rd-Party</b>
            <span>Independent lab testing</span>
          </div>
        </div>
      </section>

      <main className="site-main">
        <section className="block">
          <div className="sec-eyebrow">Why researchers choose us</div>
          <h2 className="sec-title">
            Documented purity, <em>every</em> lot.
          </h2>
          <div className="bento">
            <div className="bento-card bento-big">
              <span className="bento-n">01 — Analytical testing</span>
              <h4>Analytical Testing</h4>
              <p>Every batch is verified by an independent third-party lab before it ships.</p>
              <div className="bento-pct">
                &gt;99<span>%</span>
              </div>
              <svg className="bento-trace" viewBox="0 0 420 110" preserveAspectRatio="none" aria-hidden="true">
                <path d={TRACE_PATH + " L420,102 L0,102 Z"} fill="rgba(249,115,22,.12)" />
                <path d={TRACE_PATH} fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <span className="bento-note">Illustrative sample trace</span>
            </div>
            <div className="bento-card bento-glow">
              <span className="bento-n">02 — Research use only</span>
              <h4>Research Use Only</h4>
              <p>Sold exclusively for laboratory research — never marketed for human or animal use.</p>
            </div>
            <div className="bento-card">
              <span className="bento-n">03 — Cold-chain shipping</span>
              <h4>Cold-Chain Shipping</h4>
              <p>Packaged to protect compound integrity from our facility to your lab.</p>
            </div>
            <div className="bento-card bento-wide bento-glow">
              <span className="bento-n">04 — COA on every order</span>
              <h4>COA On Every Order</h4>
              <p>Look up or download the Certificate of Analysis for any lot number.</p>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="section-head">
            <div>
              <div className="sec-eyebrow">The collection</div>
              <h2 className="sec-title">
                Featured Research <em>Compounds</em>
              </h2>
              <p>A snapshot of our launch catalog — full list available in Shop.</p>
            </div>
            <Link href="/shop" className="viewall">
              View all products →
            </Link>
          </div>
          <div className="product-grid">
            {products?.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        <section className="block">
          <div className="ruo-banner">
            <div className="ic">!</div>
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
    </div>
  );
}
