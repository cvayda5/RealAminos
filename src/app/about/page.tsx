import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="site-main">
      <div style={{ paddingTop: 36 }}>
        <div className="lab-hero">
          <div>
            <h2>Founded on a Simple Problem: Nobody Could Find a Source They Could Trust.</h2>
            <p>
              RealAminos was founded by Colton Vayda, based in Surprise, Arizona. After years
              spent around the research peptide space — buying, researching, and dealing with
              the same sourcing headaches everyone else runs into — Colton kept hitting the same
              wall: it was nearly impossible to find a supplier that was actually reliable.
              RealAminos exists to fix that, with rigorous third-party testing, straightforward
              policies, and a company that actually answers when you reach out.
            </p>
          </div>
          <div className="founder-card">
            <h3>Founder</h3>
            <div className="founder-row">
              <span>Colton Vayda</span>
              <b>Founder</b>
            </div>
            <div className="founder-row">
              <span>Background</span>
              <b>Years in the Peptide Space</b>
            </div>
            <div className="founder-row">
              <span>Based In</span>
              <b>Surprise, AZ</b>
            </div>
          </div>
        </div>

        <div className="section-head">
          <div>
            <h2>What Makes Us Different</h2>
          </div>
        </div>
        <div className="trust-grid" style={{ marginBottom: 60 }}>
          <div className="trust-card">
            <div className="ic">Y</div>
            <h4>Years in the Peptide Space</h4>
            <p>Founder Colton has spent years around research peptides, and knows firsthand where most sources fall short — that experience shapes every part of how RealAminos runs.</p>
          </div>
          <div className="trust-card">
            <div className="ic">P</div>
            <h4>Built to Solve a Real Problem</h4>
            <p>RealAminos exists because reliable sourcing was too hard to find. Every policy and process here is built around fixing that, not just selling product.</p>
          </div>
          <div className="trust-card">
            <div className="ic">A</div>
            <h4>Proudly Based in Arizona</h4>
            <p>Headquartered in Surprise, Arizona, with plans to open physical retail locations across the state.</p>
          </div>
          <div className="trust-card">
            <div className="ic">S</div>
            <h4>Held to a Higher Standard</h4>
            <p>Independent lab testing on every batch, because cutting corners isn&apos;t in our nature.</p>
          </div>
        </div>

        <div className="legal-body" style={{ paddingBottom: 60 }}>
          <h3>Our Story</h3>
          <p>
            RealAminos started with a simple frustration: an industry full of research peptide
            sellers, but very few you could actually trust. After years spent around the space —
            sourcing, researching, and running into the same reliability problems everyone else
            deals with — Colton saw an opportunity to build something different: rigorous
            third-party testing, straightforward policies, and a company that actually answers
            when you reach out.
          </p>
          <p>
            We&apos;re still early — RealAminos is a small, independently-run operation based out
            of Surprise, Arizona — but we&apos;re building for the long run. That means real lab
            testing on every batch, honest answers about what Research Use Only actually means,
            and eventually, physical locations here in Arizona where researchers can walk in,
            sign a waiver, and walk out with what they came for.
          </p>
          <p style={{ marginTop: 24 }}>
            Questions for us directly? Reach out any time at{" "}
            <a href="mailto:support@shoprealaminos.com" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>
              support@shoprealaminos.com
            </a>
            , or browse our <Link href="/shop" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>current catalog</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
