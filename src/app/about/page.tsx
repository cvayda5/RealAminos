import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="site-main">
      <div style={{ paddingTop: 36 }}>
        <div className="lab-hero">
          <div>
            <h2>Built by a Firefighter and His Son. Run Like a Family.</h2>
            <p>
              RealAminos was founded by Colton and Brian Vayda — a father-and-son team based in
              Surprise, Arizona. Brian is a career firefighter, and together they started
              RealAminos to bring the same standards he holds himself to on the job —
              discipline, accountability, and zero shortcuts — to the research peptide industry.
            </p>
          </div>
          <div className="hero-card">
            <h3>Founders</h3>
            <div className="coa-row">
              <span>Brian Vayda</span>
              <b>Co-Founder, Firefighter</b>
            </div>
            <div className="coa-row">
              <span>Colton Vayda</span>
              <b>Co-Founder</b>
            </div>
            <div className="coa-row">
              <span>Ownership</span>
              <b>Firefighter-Owned</b>
            </div>
            <div className="coa-row">
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
            <div className="ic">F</div>
            <h4>Firefighter-Owned & Operated</h4>
            <p>Co-founder Brian is a career firefighter, and the same integrity and attention to detail he brings to the job guides every decision we make.</p>
          </div>
          <div className="trust-card">
            <div className="ic">V</div>
            <h4>Father & Son, Built Together</h4>
            <p>Brian and Colton founded RealAminos together, and we run it the same way — hands-on and personally invested in every order.</p>
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
            sellers, but very few you could actually trust. As a career firefighter, Brian is
            used to operating under strict protocols where attention to detail isn&apos;t
            optional — it protects people. He and Colton saw an opportunity to bring that same
            mindset to research compounds: rigorous third-party testing, straightforward
            policies, and a company that actually answers when you reach out.
          </p>
          <p>
            We&apos;re still early — RealAminos is a small, family-run operation based out of
            Surprise, Arizona — but we&apos;re building for the long run. That means real lab
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
