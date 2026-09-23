"use client";

import Image from "next/image";

// Gate screen shown BEFORE CartDrawer ever calls /api/checkout/zelle (which
// is what creates the real order and reveals the QR code / where to pay).
// Added after a real order shipped without its order number ever making it
// into the Zelle note — that note is the only thing that links an incoming
// payment back to a specific order (see finalizeZellePayment.ts and the
// "Verify note says ORDER# before marking paid" reminder on /admin/orders),
// so a payment with no note or the wrong note just looks like unexplained
// money in the account, not "case closed, ship it."
//
// Previously this same warning only appeared as one bold line UNDER the QR
// code, after the customer already had everything they came for (the amount
// and where to send it) — easy to skim past. Putting it here, as its own
// required step before that information even exists, is the actual fix.
interface Props {
  onContinue: () => void;
  loading: boolean;
  error: string | null;
}

export default function ZelleNoteGuide({ onContinue, loading, error }: Props) {
  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>
        Before you pay — one required step
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
        Zelle payments are matched to orders by the <strong>note</strong> field. If it&rsquo;s
        blank, we have no way to tell which order your payment belongs to, and it gets refunded
        instead of shipped. On the next screen we&rsquo;ll give you your order number — here&rsquo;s
        exactly where that field is so you don&rsquo;t miss it:
      </p>

      <ol style={{ margin: "0 0 14px", paddingLeft: 20, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.65 }}>
        <li>Open Zelle — inside your banking app, or the standalone Zelle app.</li>
        <li>Enter the recipient and amount like normal.</li>
        <li>
          Look for a field called <strong>&ldquo;Add a note,&rdquo;</strong>{" "}
          <strong>&ldquo;Memo,&rdquo;</strong> or <strong>&ldquo;What&rsquo;s this for?&rdquo;</strong> —
          most apps show it right before the final Send button.
        </li>
        <li>Type your order number in that field, exactly as shown on the next screen — nothing else needed.</li>
        <li>Send.</li>
      </ol>

      <div
        style={{
          background: "var(--paper-2)",
          border: "1.5px solid var(--line)",
          borderRadius: 10,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          Real example — this is what to look for
        </div>
        <Image
          src="/zelle-note-example.png"
          alt="Zelle's Review Payment Details screen, with the Message field circled — that's the note field your order number goes in."
          width={1290}
          height={1300}
          style={{ width: "100%", height: "auto", borderRadius: 8, border: "1px solid var(--line)" }}
        />
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>
          ↑ from a real Zelle payment — the &ldquo;Message&rdquo; field circled above is the note.
          Your real order number is on the next screen.
        </div>
      </div>

      {error && (
        <p className="error" style={{ marginBottom: 10 }}>
          {error}
        </p>
      )}

      <button type="button" className="btn" style={{ width: "100%" }} onClick={onContinue} disabled={loading}>
        {loading ? "Creating your order…" : "Got it — show me where to pay"}
      </button>
    </div>
  );
}
