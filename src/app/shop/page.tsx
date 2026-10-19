import Link from "next/link";
import type { Metadata } from "next";
import { BULK_TIERS } from "@/lib/promotions/bulkPricing";
import BridgeVial from "./BridgeVial";
import Icon from "./BridgeIcon";
import "./bridge.css";

// /shop is a "bridge" page: it tells the story (third-party testing, COAs,
// research-use-only) and sends the visitor on to the real catalog at
// /shop/all. It deliberately names NO compounds and shows NO doses, prices or
// product photos — everything product-specific lives behind the Shop buttons.
// (Keep it that way: no database reads, no product images, no compound names
// in any copy, alt text or metadata on this page.)
export const metadata: Metadata = {
  title: "Shop Research Peptides | RealAminos",
  description:
    "Independently tested research peptides with lot-specific Certificates of Analysis. For laboratory research use only.",
};

const CATALOG = "/shop/all";

export default function ShopBridgePage() {
  const top = BULK_TIERS[BULK_TIERS.length - 1];
  const bulk = `Buy ${top.minQty} or more, save ${top.percentOff}%`;

  return (
    <div className="br">
      {/* top deal strip */}
      <div className="br-strip">
        <strong>{bulk}</strong>
        <span>Applied automatically at checkout</span>
      </div>

      {/* hero */}
      <section className="br-hero">
        <div className="br-hero-copy">
          <div className="br-eyebrow">Research-grade. Lot-verified.</div>
          <h1>
            Research peptides, <em>verified</em> lot by lot.
          </h1>
          <p className="br-lead">
            Every lot is independently tested, with a Certificate of Analysis you can check
            against the lot number on your vial before you ever open it.
          </p>
          <Link href={CATALOG} className="br-btn br-btn-lg">
            Shop All Peptides
          </Link>
          <div className="br-deal">
            <strong>{bulk}</strong> — applied automatically at checkout.
          </div>
          <ul className="br-checks">
            <li>Third-party tested, every lot</li>
            <li>&gt;99% purity standard</li>
            <li>Reports you can look up by lot</li>
          </ul>
        </div>

        <div className="br-fan" aria-hidden="true">
          <BridgeVial className="br-fan-v v1" />
          <BridgeVial className="br-fan-v v2" />
          <BridgeVial className="br-fan-v v3" />
          <BridgeVial className="br-fan-v v4" />
          <BridgeVial className="br-fan-v v5" />
        </div>
      </section>

      {/* feature cards */}
      <section className="br-features">
        <div>
          <Icon name="doc" />
          <h3>COA included</h3>
          <p>Every lot is backed by a matching Certificate of Analysis.</p>
        </div>
        <div>
          <Icon name="list" />
          <h3>Reports organized by lot</h3>
          <p>Find and download COAs by lot number.</p>
        </div>
        <div>
          <Icon name="shield" />
          <h3>Purity-focused quality</h3>
          <p>Third-party tested for purity and identity.</p>
        </div>
        <div>
          <Icon name="flask" />
          <h3>Research buyers only</h3>
          <p>For laboratory research use only.</p>
        </div>
      </section>

      {/* lot matching */}
      <section className="br-lot">
        <div className="br-eyebrow">Lot-specific. Always.</div>
        <h2>Match the lot on your vial to its report.</h2>
        <p>
          Each vial is labeled with a lot number. Look that number up and the Certificate of
          Analysis for that exact lot is waiting for you.
        </p>
        <div className="br-lot-visual" aria-hidden="true">
          <div className="br-pill">
            Vial lot: <b>RA-0001</b>
          </div>
          <div className="br-lot-line">
            <i />
          </div>
          <div className="br-pill">
            COA lot: <b>RA-0001</b>
          </div>
        </div>
        <div className="br-note">Example lot numbers shown for illustration.</div>
      </section>

      {/* quality */}
      <section className="br-quality">
        <div className="br-quality-head">
          <div>
            <div className="br-eyebrow">Quality you can count on</div>
            <h2>
              Purity-focused. Research-driven. Built for confidence.
            </h2>
          </div>
          <p>
            We work with independent labs and follow purity-focused standards so you can focus
            on your research.
          </p>
        </div>
        <div className="br-quality-grid">
          <div>
            <Icon name="shield" />
            <h3>Third-party tested</h3>
            <p>Independent lab testing for purity and identity.</p>
          </div>
          <div>
            <Icon name="target" />
            <h3>Purity-focused standards</h3>
            <p>Quality controls applied to every lot.</p>
          </div>
          <div>
            <Icon name="tag" />
            <h3>Clear labeling</h3>
            <p>Every vial is labeled for research use only.</p>
          </div>
          <div>
            <Icon name="box" />
            <h3>Careful packaging</h3>
            <p>Cold-chain shipping, packed to protect every vial.</p>
          </div>
        </div>
      </section>

      {/* shop / COA cards */}
      <section className="br-cards">
        <div className="br-cards-intro">
          <div className="br-eyebrow">Shop RealAminos</div>
          <h2>Browse the catalog or review COAs.</h2>
          <p>All products are for laboratory research use only.</p>
        </div>
        <div className="br-card br-card-orange">
          <div className="br-card-copy">
            <div className="br-kicker">Research catalog</div>
            <h3>Shop all research peptides</h3>
            <p>Browse the complete RealAminos catalog.</p>
            <Link href={CATALOG} className="br-btn br-btn-white">
              Shop All Peptides
            </Link>
          </div>
          <BridgeVial className="br-card-vial" />
        </div>
        <div className="br-card br-card-dark">
          <div className="br-card-copy">
            <div className="br-kicker dark">Lab reports</div>
            <h3>View current COAs</h3>
            <p>Search and download lot-specific reports.</p>
            <Link href="/lab" className="br-btn">
              View COAs
            </Link>
          </div>
          <div className="br-coa-stack" aria-hidden="true">
            <span />
            <span />
            <span>
              <Icon name="shield" />
            </span>
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="br-final">
        <BridgeVial className="br-final-vial" />
        <div className="br-final-copy">
          <h2>Ready to get started?</h2>
          <p>Explore our research peptides or review COAs for available lots.</p>
        </div>
        <div className="br-final-btns">
          <Link href={CATALOG} className="br-btn br-btn-lg">
            Shop All Peptides
          </Link>
          <Link href="/lab" className="br-btn br-btn-outline br-btn-lg">
            View COAs
          </Link>
        </div>
      </section>

      <div className="br-legal">
        For laboratory research use only. Not for human or veterinary use. Not a drug, food,
        dietary supplement, or cosmetic.
      </div>
    </div>
  );
}
