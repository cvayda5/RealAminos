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
          Surprise, Arizona, collects when you use shoprealaminos.com, how we use it, and the
          choices you have. By using the site you agree to this policy.
        </p>

        <h3>Information We Collect</h3>
        <p>
          <strong>Account information:</strong> your email address and password (stored only as a
          secure hash), plus the one-time codes we email you when you log in, and optional
          two-factor authentication details if you enable them.
        </p>
        <p>
          <strong>Order information:</strong> your name, shipping address, email, the items you
          order, order totals, discount or affiliate codes you use, and points earned. If you pay
          by card, payment is handled by our payment processor, Whop — we never see or store your
          full card number. If you pay by Zelle, we see only the payment details Zelle provides us
          (such as the sender name and the note on the payment).
        </p>
        <p>
          <strong>Affiliate applications:</strong> name, email, Instagram handle, requested code,
          and Zelle contact information used to pay commissions.
        </p>
        <p>
          <strong>Support messages:</strong> anything you send us through the Support page or by
          email.
        </p>
        <p>
          <strong>Technical information:</strong> basic data your browser sends automatically (IP
          address, browser type, pages requested) and cookies described below.
        </p>

        <h3>How We Use Information</h3>
        <p>
          To create and secure your account, process and ship orders, send order confirmations and
          shipping updates, provide customer support, operate the affiliate and points programs,
          prevent fraud and abuse, comply with legal obligations, and measure how our advertising
          performs.
        </p>

        <h3>Who We Share It With</h3>
        <p>
          We do not sell your personal information. We share it only with service providers that
          help us run the store, and only as needed for them to do so: Supabase (account and
          database hosting), Vercel (website hosting), Resend (transactional email), Whop (card
          payment processing), Shippo and the shipping carriers (labels and delivery), and Google
          (advertising measurement). We may also disclose information if required by law or to
          protect our rights, or in connection with a sale of the business.
        </p>

        <h3>Cookies &amp; Similar Technologies</h3>
        <p>
          We use a cookie to keep you logged in, and browser storage to remember small preferences
          (such as your chosen page layout and that you have acknowledged our research-use
          statement for the current visit). We also use Google&apos;s advertising tag, which may
          set cookies to measure ad performance. You can block or delete cookies in your browser
          settings; the site&apos;s login and checkout will not work without the login cookie.
        </p>

        <h3>Data Retention &amp; Security</h3>
        <p>
          We keep order and account records for as long as your account is active and as long as
          needed for accounting, tax, and legal purposes. We use industry-standard safeguards,
          including encrypted connections and email-based login verification, but no method of
          transmission or storage is perfectly secure.
        </p>

        <h3>Your Choices</h3>
        <p>
          You can ask us to access, correct, or delete the personal information we hold about you
          (subject to records we must keep by law) by emailing{" "}
          <a href="mailto:support@shoprealaminos.com" style={link}>
            support@shoprealaminos.com
          </a>
          . You can unsubscribe from non-essential email at any time; order and security emails
          will still be sent.
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
