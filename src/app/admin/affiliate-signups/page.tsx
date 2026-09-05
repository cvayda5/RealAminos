import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AffiliateSignup } from "@/types/database";
import AffiliateSignupRow from "./AffiliateSignupRow";

export default async function AdminAffiliateSignupsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/affiliate-signups");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal affiliate applications — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  // Uses the service-role client the same way /admin/discounts does —
  // there's no customer-facing (or even staff-session) select policy that
  // matters here, only the admin-all policy, so this stays consistent with
  // how the other staff tables that don't have a customer angle are read.
  const admin = createAdminClient();
  const { data: signups, error } = await admin
    .from("affiliate_signups")
    .select("id, first_name, last_name, instagram_handle, email, preferred_code, contacted, created_at")
    .order("created_at", { ascending: false })
    .returns<AffiliateSignup[]>();

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1100 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Affiliate Signups</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 620 }}>
              Applications submitted from the public Affiliate Program page. Reach out, then
              create their code on the Discount Codes page and mark them contacted here.
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
                <th>Name</th>
                <th>Instagram</th>
                <th>Email</th>
                <th>Preferred Code</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {signups?.map((s) => (
                <AffiliateSignupRow key={s.id} signup={s} />
              ))}
            </tbody>
          </table>
          {signups?.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No affiliate applications yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
