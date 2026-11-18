import NotifyForm from "@/components/NotifyForm";

// "Get notified" block at the bottom of the catalog page. The upcoming
// compounds (GLOW, KLOW, MOTS-c, CJC-1295 (no DAC), the BPC-157 + TB-500
// blend and GLP-3 (RT) 20mg) are now real catalog products with stock 0, so
// they appear in the grid above as "Coming Soon" with their own ETA — this
// section no longer lists them a second time. It keeps the one thing the grid
// can't do: collect an email (NotifyForm → /api/coming-soon/notify) so
// visitors hear when they land.
//
// Keep the copy to what the items ARE, never what they do: no health, dosing
// or results claims. Everything on this site is for laboratory research use
// only.
export default function ComingSoon() {
  return (
    <section aria-labelledby="coming-soon-title" style={{ margin: "64px 0 8px" }}>
      <div className="sec-eyebrow">Coming soon</div>
      <h2 id="coming-soon-title" className="sec-title">
        Be first when they <em>land</em>
      </h2>
      <p style={{ color: "var(--muted)", margin: "6px 0 24px", maxWidth: 640, lineHeight: 1.6 }}>
        New research compounds are listed above as Coming Soon. Each one will launch with
        independent third-party testing and a lot-specific Certificate of Analysis. Leave your
        email and we&apos;ll tell you the moment they&apos;re in stock.
      </p>
      <NotifyForm />
      <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
        Coming Soon items are not yet available to order. For laboratory research use only.
      </p>
    </section>
  );
}
