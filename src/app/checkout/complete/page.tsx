"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";

type Phase = "confirming" | "success" | "failed" | "timeout";

// Landing page after a Whop checkout — Whop redirects here with
// ?pending=<pending_checkout id> regardless of outcome. The real
// confirmation happens server-side via /api/webhooks/whop, which usually
// lands within a few seconds, so this just polls the status a few times
// rather than trusting anything in the URL itself.
export default function CheckoutCompletePage() {
  return (
    <Suspense>
      <CheckoutCompleteInner />
    </Suspense>
  );
}

function CheckoutCompleteInner() {
  const searchParams = useSearchParams();
  const pendingId = searchParams.get("pending");
  const [phase, setPhase] = useState<Phase>("confirming");
  const { clear } = useCart();

  useEffect(() => {
    if (!pendingId) {
      setPhase("failed");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      const res = await fetch(`/api/checkout/whop/${pendingId}/status`);
      const body = await res.json().catch(() => ({}));

      if (cancelled) return;

      if (body.status === "completed") {
        setPhase("success");
        // The webhook has now created the real order server-side — the
        // items sitting in the client-side cart just paid for it, so clear
        // them out instead of leaving them looking like they still need
        // checking out. (This never fired before — clear() existed on
        // CartContext but nothing actually called it after a purchase.)
        clear();
        return;
      }
      if (body.status === "failed") {
        setPhase("failed");
        return;
      }
      if (attempts >= 15) {
        setPhase("timeout");
        return;
      }
      setTimeout(poll, 2000);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [pendingId]);

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 560, textAlign: "center", paddingTop: 60 }}>
        {phase === "confirming" && (
          <>
            <h1>Confirming Your Payment…</h1>
            <p style={{ color: "var(--muted)" }}>
              This usually takes just a few seconds. Don&apos;t close this page.
            </p>
          </>
        )}
        {phase === "success" && (
          <>
            <h1>Order Confirmed 🎉</h1>
            <p style={{ color: "var(--muted)" }}>
              Your payment went through and your order has been placed. A confirmation email is
              on its way.
            </p>
            <Link href="/account/orders" className="btn" style={{ marginTop: 16, display: "inline-block" }}>
              View My Orders
            </Link>
          </>
        )}
        {phase === "failed" && (
          <>
            <h1>Payment Didn&apos;t Go Through</h1>
            <p style={{ color: "var(--muted)" }}>
              Your card wasn&apos;t charged and no order was placed. Any points you redeemed for
              this attempt have been refunded to your balance. Head back to the shop to try again.
            </p>
            <Link href="/shop" className="btn" style={{ marginTop: 16, display: "inline-block" }}>
              Back to Shop
            </Link>
          </>
        )}
        {phase === "timeout" && (
          <>
            <h1>Still Working On It…</h1>
            <p style={{ color: "var(--muted)" }}>
              This is taking longer than usual to confirm. If your payment succeeded, it&apos;ll
              show up on your orders page shortly — otherwise, contact{" "}
              <a href="mailto:support@shoprealaminos.com" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>
                support@shoprealaminos.com
              </a>{" "}
              with your Whop receipt.
            </p>
            <Link href="/account/orders" className="btn" style={{ marginTop: 16, display: "inline-block" }}>
              Check My Orders
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
