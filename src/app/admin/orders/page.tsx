import Link from "next/link";
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
    redirect("/login?next=/admin/orders");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal order management — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5, marginBottom: 18 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
          <div className="admin-note">
            Promote this account with a SQL command in README.md, then refresh this page.
          </div>
        </div>
      </main>
    );
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .returns<OrderWithItems[]>();

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Orders</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
              {orders?.length ?? 0} order(s) — update status and tracking as fulfillment progresses.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/admin/discounts" className="btn btn-outline">
              Discount Codes
            </Link>
            <Link href="/admin/affiliates" className="btn btn-outline">
              Affiliate Sales
            </Link>
            <Link href="/admin/affiliate-signups" className="btn btn-outline">
              Affiliate Signups
            </Link>
            <Link href="/admin/reports" className="btn btn-outline">
              Revenue Reports
            </Link>
            <Link href="/admin/points" className="btn btn-outline">
              Points Program
            </Link>
            <Link href="/admin/staff" className="btn btn-outline">
              Manage Staff
            </Link>
            <Link href="/admin/inventory" className="btn btn-outline">
              Inventory
            </Link>
            <Link href="/admin/products" className="btn btn-outline">
              Products
            </Link>
          </div>
        </div>

        {error && <p className="error">{error.message}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Items</th>
                <th>Ship To</th>
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
          {orders?.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No orders yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
