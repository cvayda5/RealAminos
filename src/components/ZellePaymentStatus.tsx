"use client";

// The customer-facing half of the Zelle self-service flow — a live 20-
// minute countdown plus the "I've Sent My Zelle Payment" button that
// actually finalizes the order (decrements stock, awards points, flips
// status to Processing — see /api/orders/[id]/mark-paid). Used from both
// CartDrawer's checkout panel (right after the order is created) and the
// My Orders page (if they come back to it later) — each parent keeps its
// own QR code / instructions markup and just drops this in for the
// interactive part, so the two call sites can never have this logic drift
// out of sync with each other.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Kept in sync by eye with ZELLE_PAYMENT_WINDOW_MINUTES in
// src/lib/orders/finalizeZellePayment.ts — this is just what the countdown
// displays; the server is what actually enforces the window, so a mismatch
// here would only ever show a misleading timer, never let a stale payment
// through.
const WINDOW_MINUTES = 20;

interface Props {
  orderId: string;
  // ISO timestamp — pass the server's order.created_at (from the zelle
  // checkout response or the order row itself), never a client-side
  // Date.now(), so this always agrees with what the server checks.
  createdAt: string;
  // account/orders is a Server Component list; router.refresh() alone
  // re-renders it with the new status. CartDrawer has no such list to
  // refresh, so it can pass its own callback instead (or nothing).
  onPaid?: () => void;
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ZellePaymentStatus({ orderId, createdAt, onPaid }: Props) {
  const router = useRouter();
  const deadline = new Date(createdAt).getTime() + WINDOW_MINUTES * 60 * 1000;
  const [now, setNow] = useState(() => Date.now());
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = deadline - now;
  const expired = remaining <= 0;

  async function handleMarkPaid() {
    setMarking(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/mark-paid`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setMarking(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't confirm this payment — try again in a moment.");
      return;
    }
    setDone(true);
    onPaid?.();
    router.refresh();
  }

  if (done) {
    return (
      <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 700, color: "#059669" }}>
        ✓ Payment confirmed — this order is now processing.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {!expired ? (
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--muted)" }}>
          Send the Zelle payment within <strong>{formatRemaining(remaining)}</strong>, then tap
          the button below — that&apos;s what actually confirms your order.
        </p>
      ) : (
        <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "#b91c1c" }}>
          The 20-minute window to confirm this payment has passed. If you already sent it, email{" "}
          <strong>info@shoprealaminos.com</strong> with your order number and we&apos;ll sort it
          out.
        </p>
      )}
      <button
        type="button"
        className="btn"
        style={{ width: "100%" }}
        onClick={handleMarkPaid}
        disabled={marking || expired}
      >
        {marking ? "Confirming…" : "I've Sent My Zelle Payment"}
      </button>
      {error && (
        <p className="error" style={{ marginTop: 6 }}>
          {error}
        </p>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
        Tapping this doesn&apos;t skip verification — we still check our Zelle activity for your
        order number and amount before shipping. This just makes sure we never oversell an item
        while a payment is in flight.
      </p>
    </div>
  );
}
