export const metadata = {
  title: "Privacy Policy — RealAminos",
  description: "How RealAminos collects, uses, and protects your information.",
};

const link = { color: "var(--orange-dark)", fontWeight: 700 } as const;

export default function PrivacyPolicyPage() {
  return (
    <main className="site-main">
      <div className="legal-body" style={{ padding: "36px 0 60px" }}>
        <h1>Privacy Policy</h1>
        <p>
          <strong>Effective date:</strong> October 5, 2026
        </p>
        <p>
          This policy explains what information RealAminos (&quot;we,&quot; &quot;us&quot;), based in
          Surprise, Arizona, collects when you use shoprealaminos.com and how we use it. In short:
          we use your information to fulfill your order, we keep it private, and we do not sell it.
        </p>

        <h3>Information We Collect</h3>
        <p>
          <strong>Account information:</strong> your email address and password (stored only as a
          secure hash), and the one-time codes we email you when you log in.
        </p>
        <p>
          <strong>Order information:</strong> your name, shipping address, email, the items you
          order, order totals, and any discount or affiliate code you use. We accept payment by
          Zelle, and we see only the payment details Zelle provides us (such as the sender name
          and the payment note). We do not collect or store card or bank account numbers.
        </p>
        <p>
          <strong>Affiliate applications and support messages:</strong> the details you submit
          through our Affiliate Program form (including the Zelle contact used to pay commissions)
          and anything you send us through the Support page or by email.
        </p>

        <h3>How We Use Your Information</h3>
        <p>
          Your information is used to fulfill your orders: processing payment, packing and shipping
          your order, emailing order confirmations and shipping updates, providing customer
          support, and keeping your account secure. We also use it to keep the records we are
          required to keep for accounting, tax, and legal purposes.
        </p>
        <p>
          <strong>Email marketing:</strong> we may in the future send promotional emails (such as
          new products and sales) to the email address on your account. If we do, every marketing
          email will include a link to unsubscribe, and you can also opt out at any time by
          emailing us. Order, shipping, and account-security emails are not marketing and will
          still be sent.
        </p>

        <h3>Who We Share It With</h3>
        <p>
          We do not sell, rent, or trade your personal information. We share it only with the
          service providers that help us run the store and deliver your order, and only what they
          need to do their job: our website and database hosts (Vercel and Supabase), our email
          service (Resend), and Shippo and the shipping carriers that deliver your package. We may also disclose information if the law requires it.
        </p>

        <h3>Cookies</h3>
        <p>
          We use a cookie to keep you logged in, and your browser&apos;s storage to remember small
          preferences (such as your chosen page layout). The site also loads a Google advertising
          tag, which may set cookies used to measure how our ads perform. You can block or delete
          cookies in your browser settings, but you will not be able to log in or check out without
          the login cookie.
        </p>

        <h3>Security &amp; Retention</h3>
        <p>
          We take reasonable steps to protect your information, including encrypted connections,
          hashed passwords, and email-code verification at every login. Access to customer data is
          limited to our staff. We keep order and account records for as long as your account is
          active and as long as needed for accounting, tax, and legal purposes. No method of
          transmission or storage is perfectly secure, so we cannot guarantee absolute security.
        </p>

        <h3>Your Choices</h3>
        <p>
          You can ask us to access, correct, or delete the personal information we hold about you
          (except records we are legally required to keep) by emailing{" "}
          <a href="mailto:support@shoprealaminos.com" style={link}>
            support@shoprealaminos.com
          </a>
          .
        </p>

        <h3>Age Requirement</h3>
        <p>
          Our site is intended only for adults 21 and over. We do not knowingly collect information
          from anyone under 21.
        </p>

        <h3>Changes to This Policy</h3>
        <p>
          We may update this policy from time to time. The effective date above shows when it was
          last changed.
        </p>

        <h3>Contact</h3>
        <p>
          RealAminos, Surprise, Arizona —{" "}
          <a href="mailto:support@shoprealaminos.com" style={link}>
            support@shoprealaminos.com
          </a>
        </p>
      </div>
    </main>
  );
}
