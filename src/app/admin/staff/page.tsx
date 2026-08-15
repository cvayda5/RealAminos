import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";
import StaffRow from "./StaffRow";

export default async function StaffPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/staff");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal staff management — not linked from customer-facing pages.</p>
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

  // Uses the service-role client because listing every account (not just
  // your own) needs to see past the "see your own row" RLS policy — this is
  // safe here specifically because we just confirmed above, using the
  // caller's own session, that they're an admin.
  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, is_admin, created_at")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Staff Access</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
              Promote any account that has already signed up to admin, or remove access. This
              doesn&apos;t create accounts — staff sign up for themselves on the Sign Up page
              (with their own password and 2FA), then an existing admin grants access here.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/admin/orders" className="btn btn-outline">
              Back to Orders
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
            <Link href="/admin/points" className="btn btn-outline">
              Points Program
            </Link>
          </div>
        </div>

        {error && <p className="error">{error.message}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Signed Up</th>
                <th>Access</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map((p) => (
                <StaffRow key={p.id} profile={p} isSelf={p.id === user.id} />
              ))}
            </tbody>
          </table>
          {profiles?.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No accounts yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
