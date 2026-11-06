import NotifyForm from "@/components/NotifyForm";

// "Coming soon" row on the catalog page. The six cards are display only —
// nothing here can be added to a cart. The only thing visitors can do is leave an
// email (NotifyForm → /api/coming-soon/notify). To change the lineup,
// edit the list below (or empty it to hide the whole section).
//
// Keep the copy to what each item IS, never what it does: no health, dosing or
// results claims. Everything on this site is for laboratory research use only.
const COMING_SOON: { name: string; size: string; note: string }[] = [
  { name: "Wolverine Blend", size: "10 mg", note: "Multi-peptide research blend." },
  { name: "KLOW", size: "80 mg", note: "Multi-peptide research blend." },
  { name: "GLOW", size: "70 mg", note: "Multi-peptide research blend." },
  { name: "CJC-1295 (no DAC)", size: "5 mg", note: "Synthetic GHRH-analog peptide." },
  { name: "MOTS-c", size: "10 mg", note: "Mitochondrial-derived peptide." },
  { name: "GLP3 (RT)", size: "20 mg", note: "Triple-agonist research peptide." },
];

export default function ComingSoon() {
  if (COMING_SOON.length === 0) return null;
  return (
    <section aria-labelledby="coming-soon-title" style={{ margin: "64px 0 8px" }}>
      <div className="sec-eyebrow">Coming soon</div>
      <h2 id="coming-soon-title" className="sec-title">
        New to the <em>catalog</em>
      </h2>
      <p style={{ color: "var(--muted)", margin: "6px 0 24px", maxWidth: 640, lineHeight: 1.6 }}>
        Six more research compounds are on the way. Each one will launch with independent
        third-party testing and a lot-specific Certificate of Analysis.
      </p>
      <NotifyForm />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {COMING_SOON.map((p) => (
          <div
            key={p.name}
            style={{
              position: "relative",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 20px 18px",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--orange)",
                border: "1px solid var(--orange)",
                borderRadius: 999,
                padding: "3px 10px",
                marginBottom: 14,
              }}
            >
              Coming soon
            </span>
            <h3 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.01em" }}>{p.name}</h3>
            <div style={{ marginTop: 4, fontWeight: 700, color: "var(--orange)" }}>{p.size}</div>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "var(--muted)" }}>
              {p.note}
            </p>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 18, fontSize: 12, color: "var(--muted)" }}>
        Not yet available to order. For laboratory research use only.
      </p>
    </section>
  );
}
