import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DiscountCode } from "@/types/database";

type Range = "all" | "30d" | "month" | "year";

const RANGES: { key: Range; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "30d", label: "Last 30 Days" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function cutoffFor(range: Range): Date | null {
  const now = new Date();
  if (range === "30d") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 30);
    return d;
  }
  if (range === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  if (range === "year") {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  return null; // "all"
}

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/affiliates");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal affiliate sales tracking — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  const requested = searchParams.range;
  const range: Range = RANGES.some((r) => r.key === requested) ? (requested as Range) : "all";
  const cutoff = cutoffFor(range);

  // Every discount code that exists, even ones that haven't been used yet —
  // an affiliate's code showing "0 orders" is exactly as useful to know as
  // one that's selling, so codes aren't only shown once they have sales.
  // Uses the service-role client the same way /admin/discounts does — no
  // customer-facing RLS policy exists for this table (see
  // 0005_discount_codes.sql).
  const admin = createAdminClient();
  const { data: codes, error: codesError } = await admin
    .from("discount_codes")
    .select("id, code, percent_off, is_active, created_at")
    .order("code", { ascending: true })
    .returns<DiscountCode[]>();

  // Orders that used a code, within the selected range. The
  // "orders_select_own_or_admin" RLS policy already lets an admin's own
  // session read every order, so no service-role client is needed here.
  let query = supabase
    .from("orders")
    .select("discount_code, subtotal, total")
    .not("discount_code", "is", null);
  if (cutoff) {
    query = query.gte("created_at", cutoff.toISOString());
  }
  const { data: orders, error: ordersError } = await query;

  type Stats = { orders: number; subtotal: number; revenue: number; discountGiven: number };
  const statsByCode = new Map<string, Stats>();

  (orders ?? []).forEach((o) => {
    const code = o.discount_code as string;
    const revenue = o.total ?? o.subtotal;
    const existing = statsByCode.get(code);
    if (existing) {
      existing.orders += 1;
      existing.subtotal += o.subtotal;
      existing.revenue += revenue;
      existing.discountGiven += o.subtotal - revenue;
    } else {
      statsByCode.set(code, {
        orders: 1,
        subtotal: o.subtotal,
        revenue,
        discountGiven: o.subtotal - revenue,
      });
    }
  });

  const rows = (codes ?? [])
    .map((c) => {
      const stats = statsByCode.get(c.code) ?? { orders: 0, subtotal: 0, revenue: 0, discountGiven: 0 };
      return { code: c, ...stats };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalDiscountGiven = rows.reduce((sum, r) => sum + r.discountGiven, 0);

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1080 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Affiliate Sales</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 620 }}>
              Revenue each discount code has brought in — use this to see exactly what an
              affiliate's code sold so they can be paid accordingly. This is raw sales data, not
              a commission calculation; apply whatever payout agreement you have with each
              affiliate on top of these numbers.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/orders" className="btn btn-outline">
              ← Orders
            </Link>
            <Link href="/admin/discounts" className="btn btn-outline">
              Discount Codes
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

        <div className="report-filter-bar">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/affiliates?range=${r.key}`}
              className={`report-filter-btn ${range === r.key ? "active" : ""}`}
            >
              {r.label}
            </Link>
          ))}
        </div>

        {(codesError || ordersError) && (
          <p className="error">{codesError?.message ?? ordersError?.message}</p>
        )}

        <div className="card" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div className="report-stat">
            <div className="report-stat-label">Orders with a code</div>
            <div className="report-stat-value">{totalOrders}</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-label">Revenue from codes</div>
            <div className="report-stat-value">${totalRevenue.toFixed(2)}</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-label">Total discount given</div>
            <div className="report-stat-value">${totalDiscountGiven.toFixed(2)}</div>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>% Off</th>
                <th>Orders</th>
                <th>Gross Sales</th>
                <th>Discount Given</th>
                <th>Revenue Collected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code.id}>
                  <td>
                    <strong style={{ fontFamily: "var(--mono)" }}>{r.code.code}</strong>
                  </td>
                  <td>
                    {r.code.is_active ? (
                      <span className="order-status-badge status-delivered">Active</span>
                    ) : (
                      <span className="order-status-badge status-processing">Inactive</span>
                    )}
                  </td>
                  <td>{r.code.percent_off}%</td>
                  <td>{r.orders}</td>
                  <td>${r.subtotal.toFixed(2)}</td>
                  <td>${r.discountGiven.toFixed(2)}</td>
                  <td style={{ fontWeight: 800 }}>${r.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr>
                  <td style={{ fontWeight: 800, border: "none" }}>Total</td>
                  <td style={{ border: "none" }}></td>
                  <td style={{ border: "none" }}></td>
                  <td style={{ fontWeight: 800, border: "none" }}>{totalOrders}</td>
                  <td style={{ fontWeight: 800, border: "none" }}>
                    ${rows.reduce((sum, r) => sum + r.subtotal, 0).toFixed(2)}
                  </td>
                  <td style={{ fontWeight: 800, border: "none" }}>${totalDiscountGiven.toFixed(2)}</td>
                  <td style={{ fontWeight: 800, border: "none" }}>${totalRevenue.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>
              No discount codes exist yet — create one on the Discount Codes page.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
