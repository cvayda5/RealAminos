import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PointTransaction, Profile } from "@/types/database";

export default async function AdminPointsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/points");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal points program management — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  // Uses the service-role client the same way the other staff-only tables
  // do — balances are computed here in JS by summing every customer's
  // ledger rows, the same aggregation approach Revenue Reports and
  // Affiliate Sales already use.
  const admin = createAdminClient();
  const [{ data: transactions, error: txError }, { data: profiles, error: profilesError }] = await Promise.all([
    admin.from("point_transactions").select("*").returns<PointTransaction[]>(),
    admin.from("profiles").select("id, email, is_admin, created_at").returns<Profile[]>(),
  ]);

  const balanceByUser = new Map<string, number>();
  (transactions ?? []).forEach((t) => {
    balanceByUser.set(t.user_id, (balanceByUser.get(t.user_id) ?? 0) + t.points);
  });

  const rows = (profiles ?? [])
    .map((p) => ({ profile: p, balance: balanceByUser.get(p.id) ?? 0 }))
    .filter((r) => r.balance !== 0)
    .sort((a, b) => b.balance - a.balance);

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Points Program</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 620 }}>
              Customers earn 1 point per dollar spent. Redeeming costs 10 points per dollar of a
              vial's own current price — that's computed live from product_variants pricing, so
              there's nothing to configure here as prices change.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
            <Link href="/admin/reports" className="btn btn-outline">
              Revenue Reports
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

        {(txError || profilesError) && <p className="error">{txError?.message ?? profilesError?.message}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.profile.id}>
                  <td>{r.profile.email}</td>
                  <td style={{ fontWeight: 700 }}>{r.balance} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No customers have earned points yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
