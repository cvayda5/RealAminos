import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { OrderWithItems } from "@/types/database";
import ThankYouTracker from "./ThankYouTracker";

// Order-specific and private — keep it out of search results (robots.ts
// disallows it too).
export const metadata: Metadata = {
  title: "Thank you for your order",
  robots: { index: false, follow: false },
};

// Always read the live order — never cache this page.
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

// The page every paid order ends up on:
//   - Zelle:   ZellePaymentStatus sends the customer here right after they
//              tap "I've Sent My Zelle Payment" and it succeeds.
//   - Bitcoin: BTCPay's "Return to store" button points here (the invoice's
//              redirectURL — see /api/checkout/bitcoin).
// URL: https://shoprealaminos.com/thank-you?order=<order id>
//
// The order is read with the customer's own session, so Row Level Security
// means only the person who placed it can ever see it. The Google Ads
// conversion (ThankYouTracker) only fires once the order is out of
// "Awaiting Payment".
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = searchParams.order ?? "";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/thank-you?order=${orderId}`)}`);
  }

  const { data: order } = UUID.test(orderId)
    ? await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .maybeSingle<OrderWithItems>()
    : { data: null };

  if (!order) {
    return (
      <main className="site-main">
        <div className="wrap" style={{ maxWidth: 640, textAlign: "center", paddingTop: 48 }}>
          <h1>We couldn&apos;t find that order</h1>
          <p style={{ color: "var(--muted)" }}>
            It may belong to a different account. You can see every order on your account on the
            My Orders page.
          </p>
          <Link className="btn" href="/account/orders" style={{ display: "inline-block", marginTop: 12 }}>
            Go to My Orders
          </Link>
        </div>
      </main>
    );
  }

  const paid = order.status !== "Awaiting Payment";
  // What the customer actually paid: product total (after any code) plus
  // shipping, minus the Zelle discount if any. Same math as the checkout
  // routes' amountDue. A null total is a pre-discount-codes order = subtotal.
  const amountPaid =
    Math.round(((order.total ?? order.subtotal) + order.shipping_fee - order.zelle_discount_amount) * 100) / 100;
  const itemCount = order.order_items.reduce((s, i) => s + i.qty, 0);

  return (
    <main className="site-main">
      <ThankYouTracker orderNumber={order.order_number} value={amountPaid} paid={paid} />

      <div className="wrap" style={{ maxWidth: 680, paddingTop: 40 }}>
        <div className="card" style={{ textAlign: "center", padding: "36px 28px" }}>
          {paid ? (
            <>
              <div style={{ fontSize: 44, color: "var(--ok)", lineHeight: 1 }}>✓</div>
              <h1 style={{ margin: "12px 0 8px" }}>Thank you for your order!</h1>
              <p style={{ color: "var(--muted)", margin: "0 0 4px" }}>
                Order <strong style={{ color: "var(--ink)" }}>{order.order_number}</strong> is now
                processing.
              </p>
              <p style={{ color: "var(--muted)", margin: 0 }}>
                A confirmation email is on its way to{" "}
                <strong style={{ color: "var(--ink)" }}>{order.shipping_email ?? user.email}</strong>.
                We&apos;ll email your tracking number as soon as it ships.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, lineHeight: 1 }}>⏳</div>
              <h1 style={{ margin: "12px 0 8px" }}>Waiting for your payment to confirm</h1>
              <p style={{ color: "var(--muted)", margin: "0 0 4px" }}>
                Order <strong style={{ color: "var(--ink)" }}>{order.order_number}</strong> is
                saved but we haven&apos;t seen the payment confirm yet.
              </p>
              <p style={{ color: "var(--muted)", margin: 0 }}>
                {order.payment_method === "bitcoin"
                  ? "Bitcoin payments usually confirm within about an hour. This page updates by itself — you can leave it open or check My Orders later."
                  : "If you already sent it, this page will update shortly. Otherwise finish paying from the My Orders page."}
              </p>
            </>
          )}

          <div
            style={{
              margin: "24px 0 0",
              paddingTop: 18,
              borderTop: "1px solid var(--line)",
              textAlign: "left",
              fontSize: 14,
            }}
          >
            {order.order_items.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}
              >
                <span>
                  {item.product_name} ({item.size}) × {item.qty}
                </span>
                <span>{money(item.unit_price * item.qty)}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                paddingTop: 10,
                marginTop: 6,
                borderTop: "1px solid var(--line)",
              }}
            >
              <span>
                {paid ? "Total paid" : "Total due"} · {itemCount} item{itemCount === 1 ? "" : "s"}
              </span>
              <span>{money(amountPaid)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
            <Link className="btn" href="/account/orders">
              Track my order
            </Link>
            <Link className="btn btn-outline" href="/shop">
              Keep shopping
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
