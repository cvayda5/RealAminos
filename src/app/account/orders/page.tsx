import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, OrderWithItems } from "@/types/database";
import ZellePaymentStatus from "@/components/ZellePaymentStatus";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSquareOrderPayment } from "@/lib/square/syncPayment";

const STEPS: OrderStatus[] = ["Processing", "Shipped", "Delivered"];

// "Awaiting Payment" -> "awaiting-payment" so it matches the
// .status-awaiting-payment CSS class name (see globals.css) — every other
// status here is already one word, so this is the only one that needs it.
function statusSlug(status: OrderStatus) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

// Server Component: runs on the server, reads the session from cookies,
// and queries Postgres directly. Because this uses the user's own session
// (not the admin client), Row Level Security guarantees this query can
// only ever return that user's own orders — there's no "forgot a WHERE
// clause" bug possible here, the database enforces it.
export default async function OrdersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/orders");
  }

  const loadOrders = () =>
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .returns<OrderWithItems[]>();

  let { data: orders, error } = await loadOrders();

  // Card orders still "Awaiting Payment": ask Square directly whether they've
  // been paid (the webhook normally does this instantly; this is the safety
  // net if it's late or not set up). Only this customer's own orders are in
  // the list (RLS), and nothing is trusted except Square's own answer.
  const pendingSquare = (orders ?? []).filter(
    (o) => o.status === "Awaiting Payment" && o.payment_method === "square" && o.square_order_id
  );
  if (pendingSquare.length > 0) {
    const admin = createAdminClient();
    const results = await Promise.all(pendingSquare.map((o) => syncSquareOrderPayment(admin, o)));
    if (results.some((r) => r.state === "paid")) {
      ({ data: orders, error } = await loadOrders());
    }
  }

  return (
    <main className="site-main">
      <div className="wrap">
        <h1>My Orders</h1>

        {error && <p className="error">{error.message}</p>}
        {orders?.length === 0 && <p style={{ color: "var(--muted)" }}>No orders yet — try the Shop.</p>}

        {orders?.map((order) => {
          const currentIdx = STEPS.indexOf(order.status);
          return (
            <div className="card" key={order.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <strong style={{ fontSize: 18 }}>{order.order_number}</strong>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    Placed {new Date(order.created_at).toLocaleDateString()} ·{" "}
                    {order.order_items.reduce((s, i) => s + i.qty, 0)} item(s)
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {order.points_redeemed > 0 && (
                    <span className="order-status-badge status-delivered">Redeemed with Points</span>
                  )}
                  <span className={`order-status-badge status-${statusSlug(order.status)}`}>{order.status}</span>
                </div>
              </div>

              {order.status === "Awaiting Payment" && order.payment_method === "square" ? (
                <div
                  style={{
                    background: "var(--warn-bg)",
                    border: "1px solid var(--warn-line)",
                    borderRadius: 10,
                    padding: 16,
                    margin: "18px 0",
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontWeight: 800, color: "var(--orange-dark)" }}>
                    Awaiting your card payment
                  </p>
                  <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                    Amount due:{" "}
                    <strong>${((order.total ?? order.subtotal) + order.shipping_fee).toFixed(2)}</strong>. Your
                    order updates on its own as soon as the payment goes through — nothing else to do after you
                    pay.
                  </p>
                  {order.square_checkout_url && (
                    <a
                      className="btn"
                      href={order.square_checkout_url}
                      style={{ display: "inline-block", textDecoration: "none" }}
                    >
                      Pay by card →
                    </a>
                  )}
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    Already paid and still seeing this? Give it a minute and refresh, or email
                    info@shoprealaminos.com with your order number.
                  </p>
                </div>
              ) : order.status === "Awaiting Payment" && order.payment_method === "bitcoin" ? (
                <div
                  style={{
                    background: "var(--warn-bg)",
                    border: "1px solid var(--warn-line)",
                    borderRadius: 10,
                    padding: 16,
                    margin: "18px 0",
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontWeight: 800, color: "var(--orange-dark)" }}>
                    Awaiting your Bitcoin payment
                  </p>
                  <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                    Amount due:{" "}
                    <strong>${((order.total ?? order.subtotal) + order.shipping_fee).toFixed(2)}</strong>. Your
                    order updates on its own as soon as the payment confirms — nothing else to do after you pay.
                  </p>
                  {order.btcpay_checkout_url && (
                    <a
                      className="btn"
                      href={order.btcpay_checkout_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", textDecoration: "none" }}
                    >
                      Pay with Bitcoin →
                    </a>
                  )}
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    Bitcoin invoices expire after 60 minutes. If it expires before you pay, the order is
                    removed and you can simply check out again. Already paid and still seeing this? Email
                    info@shoprealaminos.com with your order number.
                  </p>
                </div>
              ) : order.status === "Awaiting Payment" ? (
                <div
                  style={{
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger-line)",
                    borderRadius: 10,
                    padding: 16,
                    margin: "18px 0",
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <Image
                    src="/zelle-qr.jpg"
                    alt="Zelle QR code"
                    width={140}
                    height={140}
                    style={{ borderRadius: 8, background: "#fff", padding: 6 }}
                  />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <p style={{ margin: "0 0 6px", fontWeight: 800, color: "var(--danger)" }}>
                      Awaiting your Zelle payment
                    </p>
                    <p style={{ margin: "0 0 4px", fontSize: 14 }}>
                      Send{" "}
                      <strong>
                        ${((order.total ?? order.subtotal) + order.shipping_fee - (order.zelle_discount_amount ?? 0)).toFixed(2)}
                      </strong>{" "}
                      via Zelle using the QR code above (5% discount already applied).
                    </p>
                    <p style={{ margin: "0 0 4px", fontSize: 14 }}>
                      You MUST put <strong>{order.order_number}</strong> in the Zelle payment note.
                    </p>
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>
                      Payments sent without the order number in the note will be refunded, not
                      fulfilled.
                    </p>
                    <ZellePaymentStatus orderId={order.id} createdAt={order.created_at} />
                  </div>
                </div>
              ) : (
                <div className="timeline">
                  {STEPS.map((s, i) => (
                    <div className={`tstep ${i <= currentIdx ? "done" : ""}`} key={s}>
                      <div className="dot">{i < currentIdx ? "✓" : i + 1}</div>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {order.tracking_number ? (
                <div style={{ marginBottom: 14 }}>
                  Tracking Number:
                  <br />
                  <span className="tracking-no">{order.tracking_number}</span>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  {order.delivery_method === "local"
                    ? "Free local delivery — same or next day."
                    : "Tracking number will appear here once your order ships."}
                </p>
              )}

              {order.shipping_name && (
                <div style={{ marginBottom: 14, fontSize: 13.5 }}>
                  <strong>Ship to:</strong>
                  <br />
                  {order.shipping_name}
                  <br />
                  {order.shipping_address_line1}
                  {order.shipping_address_line2 ? <>, {order.shipping_address_line2}</> : null}
                  <br />
                  {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                  <br />
                  {order.shipping_phone} · {order.shipping_email}
                </div>
              )}

              <table>
                <tbody>
                  {order.order_items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.product_name} ({item.size}) × {item.qty}
                      </td>
                      <td>${(item.unit_price * item.qty).toFixed(2)}</td>
                    </tr>
                  ))}
                  {order.discount_code && order.discount_percent > 0 && (
                    <>
                      <tr>
                        <td style={{ border: "none" }}>Subtotal</td>
                        <td style={{ border: "none" }}>${order.subtotal.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ border: "none", color: "var(--ok)" }}>
                          Discount ({order.discount_code}, -{order.discount_percent}%)
                        </td>
                        <td style={{ border: "none", color: "var(--ok)" }}>
                          -${(order.subtotal - (order.total ?? order.subtotal)).toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td style={{ border: "none" }}>
                      {order.delivery_method === "local" ? "Local delivery (same or next day)" : "Shipping"}
                    </td>
                    <td style={{ border: "none" }}>
                      {order.shipping_fee > 0 ? `$${order.shipping_fee.toFixed(2)}` : "FREE"}
                    </td>
                  </tr>
                  {order.payment_method === "zelle" && order.zelle_discount_amount > 0 && (
                    <tr>
                      <td style={{ border: "none", color: "var(--ok)" }}>Zelle discount (-5%)</td>
                      <td style={{ border: "none", color: "var(--ok)" }}>
                        -${order.zelle_discount_amount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 800, border: "none" }}>Total</td>
                    <td style={{ fontWeight: 800, border: "none" }}>
                      ${((order.total ?? order.subtotal) + order.shipping_fee - (order.zelle_discount_amount ?? 0)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </main>
  );
}
