import AffiliateSignupForm from "./AffiliateSignupForm";

export default function AffiliatesPage() {
  return (
    <main className="site-main">
      <div style={{ paddingTop: 36 }}>
        <div className="lab-hero">
          <div>
            <h2>Become a RealAminos Affiliate</h2>
            <p>
              Get your own discount code to share with your audience. Anyone who uses it gets{" "}
              <strong style={{ color: "white" }}>10% off any product on the site</strong>, and you
              earn a <strong style={{ color: "white" }}>10% commission</strong> on everything sold
              through your code.
            </p>
            <ul style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.9, paddingLeft: 18, margin: "18px 0 0" }}>
              <li>Your followers get 10% off any product, storewide.</li>
              <li>You earn a 10% commission on every order placed with your code.</li>
              <li>Pick a preferred code name below — we&apos;ll reach out to get it set up.</li>
            </ul>
          </div>
          <AffiliateSignupForm />
        </div>
      </div>
    </main>
  );
}
