import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="site-main">
      <div className="legal-body" style={{ padding: "36px 0 60px" }}>
        <h1>Support</h1>
        <p>
          Have a question about an order, a product, wholesale pricing, or anything else? Reach
          out any time at{" "}
          <a href="mailto:support@shoprealaminos.com" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>
            support@shoprealaminos.com
          </a>{" "}
          and a real person will get back to you.
        </p>

        <h3>Before You Email Us</h3>
        <p>
          If your question is about an existing order, include your order number and, if it&apos;s
          about a damaged, defective, or incorrect item, a photo of the issue — this lets us
          resolve it faster. See our{" "}
          <Link href="/refund-policy" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>
            Refund &amp; Return Policy
          </Link>{" "}
          for how damaged/defective claims are handled.
        </p>
        <p>
          For general product or research-use questions, our{" "}
          <Link href="/faq" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>
            FAQ
          </Link>{" "}
          page covers most common questions, including COAs, shipping, and our RUO policy.
        </p>

        <h3>Wholesale &amp; Institutional Orders</h3>
        <p>
          Laboratories and institutions ordering in volume can reach out to the same address above
          to discuss pricing.
        </p>
      </div>
    </main>
  );
}
