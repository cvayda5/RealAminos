import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PointTransaction, ProductWithVariants } from "@/types/database";
import RedeemProductGrid from "./RedeemProductGrid";

export default async function PointsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/points");
  }

  const [{ data: transactions, error }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from("point_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<PointTransaction[]>(),
    supabase
      .from("products")
      .select("*, product_variants(*)")
      .eq("is_active", true)
      .order("category")
      .returns<ProductWithVariants[]>(),
  ]);

  const balance = (transactions ?? []).reduce((sum, t) => sum + t.points, 0);

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1100 }}>
        <h1>Rewards Points</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: -6, marginBottom: 24 }}>
          Earn 1 point for every dollar you spend. Redeeming costs 10 points per dollar of a
          vial&apos;s current price — redeem one straight to your cart any time you have enough. No
          partial redemption: you need the full amount shown, all at once.
        </p>

        <div className="card" style={{ marginBottom: 28 }}>
          <div className="report-stat">
            <div className="report-stat-label">Your Balance</div>
            <div className="report-stat-value">{balance} pts</div>
          </div>
        </div>

        <h3 style={{ fontSize: 20, margin: "0 0 14px" }}>Redeem a Free Vial</h3>
        {productsError && <p className="error">{productsError.message}</p>}
        <RedeemProductGrid products={products ?? []} initialBalance={balance} />

        <h3 style={{ fontSize: 17, margin: "36px 0 12px" }}>Points History</h3>
        {error && <p className="error">{error.message}</p>}
        {transactions?.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
            No points yet — place an order to start earning.
          </p>
        )}
        {transactions && transactions.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td>{t.description ?? (t.type === "earned" ? "Points earned" : "Points redeemed")}</td>
                    <td style={{ color: t.points > 0 ? "#059669" : "#b91c1c", fontWeight: 700 }}>
                      {t.points > 0 ? `+${t.points}` : t.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
