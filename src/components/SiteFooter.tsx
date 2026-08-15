import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site">
      <div className="footer-grid">
        <div>
          <div className="logo" style={{ color: "white", marginBottom: 12 }}>
            <div className="mark">ra</div>
            <div className="name" style={{ color: "white" }}>
              real<span>aminos</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#9aa5b1", lineHeight: 1.6, maxWidth: 280 }}>
            High-purity peptide and small-molecule compounds for laboratory research.
            Independently tested. Research Use Only.
          </p>
          <p style={{ fontSize: 12.5, color: "#9aa5b1", lineHeight: 1.6, maxWidth: 280, marginTop: 10 }}>
            Firefighter-owned. Founded by a father &amp; son team.
          </p>
          <p style={{ fontSize: 12.5, color: "#9aa5b1", lineHeight: 1.6, maxWidth: 280, marginTop: 10 }}>
            Surprise, Arizona
          </p>
        </div>
        <div>
          <h5>Shop</h5>
          <Link href="/shop">All Compounds</Link>
          <Link href="/lab">Lab Testing / COAs</Link>
        </div>
        <div>
          <h5>Company</h5>
          <Link href="/about">About Us</Link>
          <Link href="/affiliates">Affiliate Program</Link>
          <Link href="/ruo-policy">RUO Policy</Link>
          <Link href="/refund-policy">Refund Policy</Link>
          <Link href="/legal">Purchaser Agreement</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/support">Support</Link>
        </div>
        <div>
          <h5>Contact</h5>
          <a href="mailto:support@shoprealaminos.com">support@shoprealaminos.com</a>
        </div>
      </div>
      <div className="footer-legal">
        RealAminos products are sold strictly for laboratory research use only. Not for human
        or animal consumption, injection, or any other use. Not a drug, food, dietary
        supplement, or cosmetic. Not for diagnostic use. Not evaluated by the FDA.
        <br />
        <br />© {new Date().getFullYear()} RealAminos. All rights reserved. &nbsp;·&nbsp;{" "}
        <Link href="/admin/orders">Staff Admin Login</Link>
      </div>
    </footer>
  );
}