import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderWithItems } from "@/types/database";
import OrderRow from "./OrderRow";

export default async function AdminOrdersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <div className="wrap">
        <h1>Admin: Orders</h1>
        <div className="notice">
          Your account isn&apos;t an admin. Promote it with a SQL command in
          README.md, then refresh this page.
        </div>
      </div>
    );
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .returns<OrderWithItems[]>();

  return (
    <div className="wrap" style={{ maxWidth: 960 }}>
      <h1>Admin: Orders</h1>
      {error && <p className="error">{error.message}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Tracking #</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </tbody>
        </table>
        {orders?.length === 0 && <p style={{ color: "var(--muted)" }}>No orders yet.</p>}
      </div>
    </div>
  );
}
