import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, OrderWithItems } from "@/types/database";

const STEPS: OrderStatus[] = ["Processing", "Shipped", "Delivered"];

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

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .returns<OrderWithItems[]>();

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
                  <span className={`order-status-badge status-${order.status.toLowerCase()}`}>{order.status}</span>
                </div>
              </div>

              <div className="timeline">
                {STEPS.map((s, i) => (
                  <div className={`tstep ${i <= currentIdx ? "done" : ""}`} key={s}>
                    <div className="dot">{i < currentIdx ? "✓" : i + 1}</div>
                    <span>{s}</span>
                  </div>
                ))}
              </div>

              {order.tracking_number ? (
                <div style={{ marginBottom: 14 }}>
                  Tracking Number:
                  <br />
                  <span className="tracking-no">{order.tracking_number}</span>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  Tracking number will appear here once your order ships.
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
                        <td style={{ border: "none", color: "#059669" }}>
                          Discount ({order.discount_code}, -{order.discount_percent}%)
                        </td>
                        <td style={{ border: "none", color: "#059669" }}>
                          -${(order.subtotal - (order.total ?? order.subtotal)).toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td style={{ border: "none" }}>Shipping</td>
                    <td style={{ border: "none" }}>
                      {order.shipping_fee > 0 ? `$${order.shipping_fee.toFixed(2)}` : "FREE"}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 800, border: "none" }}>Total</td>
                    <td style={{ fontWeight: 800, border: "none" }}>
                      ${((order.total ?? order.subtotal) + order.shipping_fee).toFixed(2)}
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
