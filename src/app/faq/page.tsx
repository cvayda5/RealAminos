"use client";

import { useState } from "react";

const FAQS = [
  {
    q: 'What does "Research Use Only" mean?',
    a: "Research Use Only (RUO) means a product is intended solely for laboratory research applications and has not been evaluated or approved by the FDA or any regulatory body for use in humans or animals. RealAminos products are sold exclusively on this basis.",
  },
  {
    q: "Who can purchase from RealAminos?",
    a: "Purchases are limited to individuals 21 or older who are purchasing solely for laboratory research purposes, on behalf of themselves, a laboratory, or an institution. See our RUO Policy for full eligibility terms.",
  },
  {
    q: "Do you provide Certificates of Analysis?",
    a: "Yes. Every lot is independently tested by a third-party laboratory before release, and results can be looked up by lot number on our Lab Testing page.",
  },
  {
    q: "How is my order packaged and shipped?",
    a: "Orders are packaged to protect compound integrity during transit. Shipping is free on orders of $200 or more (before any discount code); below that, cost is a flat rate based on your state. Specific carrier and shipping-speed options will be finalized before launch.",
  },
  {
    q: "What is your return policy?",
    a: 'Because our products are peptides and amino acids with strict temperature and environmental sensitivities, we cannot accept returns or refunds for change-of-mind or order errors. We do accept returns and exchanges for products that arrive damaged, broken, defective, or incorrect — contact us at support@shoprealaminos.com within 14 days of delivery with your order number and photos, and once verified we\'ll replace the item or issue a refund. See our full Refund & Return Policy page for details on lost shipments, exchanges, and chargebacks.',
  },
  {
    q: "Can I get bulk or institutional pricing?",
    a: "Laboratories and institutions ordering in volume can contact us directly to discuss pricing.",
  },
];

export default function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <main className="site-main">
      <div style={{ padding: "36px 0 70px", maxWidth: 820 }}>
        <h1 style={{ margin: "0 0 24px" }}>Frequently Asked Questions</h1>
        <div>
          {FAQS.map((f, i) => (
            <div className={`faq-item ${openIdx === i ? "open" : ""}`} key={f.q}>
              <button className="faq-q" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                <span>{f.q}</span>
                <span className="chev">+</span>
              </button>
              {openIdx === i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
