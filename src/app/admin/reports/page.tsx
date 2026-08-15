import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Period = "day" | "week" | "month" | "year";

const PERIODS: { key: Period; label: string; columnLabel: string }[] = [
  { key: "day", label: "Day", columnLabel: "Day" },
  { key: "week", label: "Week", columnLabel: "Week Of" },
  { key: "month", label: "Month", columnLabel: "Month" },
  { key: "year", label: "Year", columnLabel: "Year" },
];

// How many of the most recent buckets to show for each granularity — keeps
// this a readable "sheet" instead of one row per day since the store
// opened. The Total row always reflects exactly what's shown below it.
const BUCKET_LIMIT: Record<Period, number> = {
  day: 30,
  week: 12,
  month: 12,
  year: 6,
};

function startOfWeek(d: Date) {
  // Monday as the start of the week, computed in UTC so this doesn't shift
  // around based on the server's local timezone.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function bucketFor(createdAt: string, period: Period): { key: string; label: string; sortTime: number } {
  const d = new Date(createdAt);

  if (period === "day") {
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      sortTime: new Date(key).getTime(),
    };
  }

  if (period === "week") {
    const start = startOfWeek(d);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const key = start.toISOString().slice(0, 10);
    const label = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    return { key, label, sortTime: start.getTime() };
  }

  if (period === "month") {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    return { key, label, sortTime: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) };
  }

  // year
  const key = `${d.getUTCFullYear()}`;
  return { key, label: key, sortTime: Date.UTC(d.getUTCFullYear(), 0, 1) };
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/reports");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal revenue reporting — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  const requested = searchParams.period;
  const period: Period = PERIODS.some((p) => p.key === requested) ? (requested as Period) : "month";
  const activePeriod = PERIODS.find((p) => p.key === period)!;

  // Same RLS policy the Orders page relies on ("orders_select_own_or_admin")
  // lets an admin's own session read every order, so this is a normal
  // client query — no service-role key needed just to build a report.
  const { data: orders, error } = await supabase
    .from("orders")
    .select("created_at, subtotal, total")
    .order("created_at", { ascending: false });

  // "Revenue" here means what the customer actually owes after any
  // discount code — `total`, not `subtotal`. Orders placed before
  // 0005_discount_codes.sql have total = subtotal (backfilled in that
  // migration), so `total ?? subtotal` covers both cases the same way.
  const revenueOf = (o: { subtotal: number; total: number | null }) => o.total ?? o.subtotal;

  // Grouping happens here in JS rather than in SQL. Fine at this order
  // volume; if this ever gets slow, move it into a Postgres view or RPC
  // that does the date_trunc + sum server-side instead.
  const buckets = new Map<string, { label: string; revenue: number; count: number; sortTime: number }>();

  (orders ?? []).forEach((o) => {
    const { key, label, sortTime } = bucketFor(o.created_at, period);
    const existing = buckets.get(key);
    if (existing) {
      existing.revenue += revenueOf(o);
      existing.count += 1;
    } else {
      buckets.set(key, { label, revenue: revenueOf(o), count: 1, sortTime });
    }
  });

  const rows = Array.from(buckets.entries())
    .sort((a, b) => b[1].sortTime - a[1].sortTime)
    .slice(0, BUCKET_LIMIT[period])
    .map(([key, value]) => ({ key, ...value }));

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalOrders = rows.reduce((sum, r) => sum + r.count, 0);
  const allTimeRevenue = (orders ?? []).reduce((sum, o) => sum + revenueOf(o), 0);

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Revenue Reports</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 560 }}>
              Revenue here is each order&apos;s total after any discount code. There&apos;s no
              payment processor connected yet, so this reflects orders placed, not money
              actually collected.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/admin/orders" className="btn btn-outline">
              ← Orders
            </Link>
            <Link href="/admin/discounts" className="btn btn-outline">
              Discount Codes
            </Link>
            <Link href="/admin/affiliates" className="btn btn-outline">
              Affiliate Sales
            </Link>
            <Link href="/admin/affiliate-signups" className="btn btn-outline">
              Affiliate Signups
            </Link>
            <Link href="/admin/points" className="btn btn-outline">
              Points Program
            </Link>
            <Link href="/admin/staff" className="btn btn-outline">
              Manage Staff
            </Link>
          </div>
        </div>

        <div className="report-filter-bar">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/reports?period=${p.key}`}
              className={`report-filter-btn ${period === p.key ? "active" : ""}`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        {error && <p className="error">{error.message}</p>}

        <div className="card" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div className="report-stat">
            <div className="report-stat-label">
              Revenue — last {rows.length} {rows.length === 1 ? activePeriod.label.toLowerCase() : `${activePeriod.label.toLowerCase()}s`}
            </div>
            <div className="report-stat-value">${totalRevenue.toFixed(2)}</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-label">Orders in range</div>
            <div className="report-stat-value">{totalOrders}</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-label">All-time revenue</div>
            <div className="report-stat-value">${allTimeRevenue.toFixed(2)}</div>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{activePeriod.columnLabel}</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>{r.count}</td>
                  <td>${r.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr>
                  <td style={{ fontWeight: 800, border: "none" }}>Total</td>
                  <td style={{ fontWeight: 800, border: "none" }}>{totalOrders}</td>
                  <td style={{ fontWeight: 800, border: "none" }}>${totalRevenue.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No orders yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
