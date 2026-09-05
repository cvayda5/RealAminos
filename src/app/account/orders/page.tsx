import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderWithItems } from "@/types/database";
import PlaceTestOrderForm from "./PlaceTestOrderForm";

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
    redirect("/login");
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .returns<OrderWithItems[]>();

  return (
    <div className="wrap">
      <h1>My Orders</h1>

      <div className="card">
        <strong>Place a test order</strong>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          No payment processor is wired up yet — this just proves the orders table and
          RLS policies work end to end.
        </p>
        <PlaceTestOrderForm />
      </div>

      {error && <p className="error">{error.message}</p>}

      {orders?.length === 0 && <p style={{ color: "var(--muted)" }}>No orders yet.</p>}

      {orders?.map((order) => (
        <div className="card" key={order.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{order.order_number}</strong>
            <span className={`badge badge-${order.status}`}>{order.status}</span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 12px" }}>
            Placed {new Date(order.created_at).toLocaleDateString()}
          </p>
          <table>
            <tbody>
              {order.order_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name} ({item.size}) × {item.qty}</td>
                  <td>${(item.unit_price * item.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {order.tracking_number && (
            <p style={{ fontSize: 12.5, marginTop: 10 }}>
              Tracking: <code>{order.tracking_number}</code>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
