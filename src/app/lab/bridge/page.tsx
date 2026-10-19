import Link from "next/link";
import type { Metadata } from "next";
import BridgeVial from "../../shop/BridgeVial";
import Icon from "../../shop/BridgeIcon";
import "../../shop/bridge.css";

// /lab/bridge is the lab-testing twin of the /shop bridge page: it explains
// how testing and lot numbers work and sends the visitor on to the real COA
// lookup at /lab. Like /shop it names NO compounds and shows NO doses, prices
// or product photos — the product list lives behind the buttons. (Keep it that
// way: no database reads and no compound names in any copy, alt text or
// metadata on this page.) It reuses the .br-* styles from the shop bridge.
export const metadata: Metadata = {
  title: "Lab Testing & Lot Numbers | RealAminos",
  description:
    "Every lot is sampled and tested by an independent laboratory, and results are published by lot number. For laboratory research use only.",
};

const LOOKUP = "/lab";
const CATALOG = "/shop/all";

export default function LabBridgePage() {
  return (
    <div className="br">
      <div className="br-strip">
        <strong>Every lot independently tested</strong>
        <span>Results published by lot number</span>
      </div>

      {/* hero */}
      <section className="br-hero">
        <div className="br-hero-copy">
          <div className="br-eyebrow">Lab testing. Lot numbers.</div>
          <h1>
            Independent testing, <em>published</em> lot by lot.
          </h1>
          <p className="br-lead">
            A sample from every lot goes to a third-party laboratory before it&apos;s released
            for sale. The results are logged against the lot number on your vial, so you can
            check them whenever you like.
          </p>
          <Link href={LOOKUP} className="br-btn br-btn-lg">
            Look Up a COA
          </Link>
          <div className="br-deal">
            <strong>No request required</strong> — results are available for lookup by lot
            number.
          </div>
          <ul className="br-checks">
            <li>HPLC purity testing</li>
            <li>Mass-spec identity confirmation</li>
            <li>Endotoxin screening</li>
          </ul>
        </div>

        <div className="br-fan" aria-hidden="true">
          <BridgeVial className="br-fan-v v1" lot="RA-0004" />
          <BridgeVial className="br-fan-v v2" lot="RA-0003" />
          <BridgeVial className="br-fan-v v3" lot="RA-0001" />
          <BridgeVial className="br-fan-v v4" lot="RA-0002" />
          <BridgeVial className="br-fan-v v5" lot="RA-0005" />
        </div>
      </section>

      {/* feature cards */}
      <section className="br-features">
        <div>
          <Icon name="flask" />
          <h3>Every lot sampled</h3>
          <p>A sample from each incoming lot is pulled before it&apos;s released for sale.</p>
        </div>
        <div>
          <Icon name="shield" />
          <h3>Independent laboratory</h3>
          <p>Analysis is done by a third-party lab, not by us.</p>
        </div>
        <div>
          <Icon name="list" />
          <h3>Reports by lot number</h3>
          <p>Each Certificate of Analysis is logged against its lot.</p>
        </div>
        <div>
          <Icon name="doc" />
          <h3>Open to everyone</h3>
          <p>Look up any lot&apos;s results — no request required.</p>
        </div>
      </section>

      {/* lot numbers explained */}
      <section className="br-lot">
        <div className="br-eyebrow">Lot numbers, explained</div>
        <h2>Your lot number is the key to its report.</h2>
        <p>
          Each vial is labeled with a lot number. Enter it in the COA lookup and the
          Certificate of Analysis for that exact lot comes up.
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

      {/* what we test */}
      <section className="br-quality">
        <div className="br-quality-head">
          <div>
            <div className="br-eyebrow">What the lab checks</div>
            <h2>Purity. Identity. Safety screening. Documented.</h2>
          </div>
          <p>
            Every report ties back to a single lot, so what you read is what&apos;s in the
            vial in front of you.
          </p>
        </div>
        <div className="br-quality-grid">
          <div>
            <Icon name="target" />
            <h3>HPLC purity</h3>
            <p>High-performance liquid chromatography measures how pure the lot is.</p>
          </div>
          <div>
            <Icon name="flask" />
            <h3>Mass-spec identity</h3>
            <p>Mass spectrometry confirms the compound is what it should be.</p>
          </div>
          <div>
            <Icon name="shield" />
            <h3>Endotoxin screening</h3>
            <p>Each lot is screened for bacterial endotoxin levels.</p>
          </div>
          <div>
            <Icon name="list" />
            <h3>Dated reports</h3>
            <p>Reports show when the lot was tested and the results found.</p>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="br-quality">
        <div className="br-quality-head">
          <div>
            <div className="br-eyebrow">How our testing works</div>
            <h2>From incoming lot to published report.</h2>
          </div>
          <p>Three steps, the same for every lot we sell.</p>
        </div>
        <div className="br-steps">
          <div>
            <span>1</span>
            <h3>Incoming sample</h3>
            <p>A sample from every incoming lot is pulled before inventory is released.</p>
          </div>
          <div>
            <span>2</span>
            <h3>Independent analysis</h3>
            <p>
              A third-party laboratory runs purity, identity, and endotoxin testing on the
              sample.
            </p>
          </div>
          <div>
            <span>3</span>
            <h3>COA published</h3>
            <p>Results are logged against the lot number and available for lookup — no request required.</p>
          </div>
        </div>
      </section>

      {/* lookup / shop cards */}
      <section className="br-cards">
        <div className="br-cards-intro">
          <div className="br-eyebrow">Check a lot</div>
          <h2>Look up a report or browse the catalog.</h2>
          <p>All products are for laboratory research use only.</p>
        </div>
        <div className="br-card br-card-orange">
          <div className="br-card-copy">
            <div className="br-kicker">COA lookup</div>
            <h3>Find your lot&apos;s report</h3>
            <p>Search by lot number and download the Certificate of Analysis.</p>
            <Link href={LOOKUP} className="br-btn br-btn-white">
              Look Up a COA
            </Link>
          </div>
          <BridgeVial className="br-card-vial" lot="RA-0001" />
        </div>
        <div className="br-card br-card-dark">
          <div className="br-card-copy">
            <div className="br-kicker dark">Research catalog</div>
            <h3>Shop all research peptides</h3>
            <p>Browse the complete RealAminos catalog.</p>
            <Link href={CATALOG} className="br-btn">
              Shop All Peptides
            </Link>
          </div>
          <div className="br-coa-stack" aria-hidden="true">
            <span />
            <span />
            <span>
              <Icon name="box" />
            </span>
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="br-final">
        <BridgeVial className="br-final-vial" lot="RA-0001" />
        <div className="br-final-copy">
          <h2>Ready to check a lot?</h2>
          <p>Look up a Certificate of Analysis, or explore our research peptides.</p>
        </div>
        <div className="br-final-btns">
          <Link href={LOOKUP} className="br-btn br-btn-lg">
            Look Up a COA
          </Link>
          <Link href={CATALOG} className="br-btn br-btn-outline br-btn-lg">
            Shop All Peptides
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
