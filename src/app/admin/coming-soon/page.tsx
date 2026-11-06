import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Signup {
  id: string;
  email: string;
  created_at: string;
}

export default async function AdminComingSoonPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/coming-soon");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal coming-soon signups — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: signups, error } = await admin
    .from("coming_soon_signups")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .returns<Signup[]>();

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 800 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Coming Soon Signups</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 560 }}>
              People who asked to be emailed when the new products go live — {signups?.length ?? 0}{" "}
              so far. Download the list when you launch and send them one email.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/orders" className="btn btn-outline">
              ← Orders
            </Link>
            <a href="/api/admin/coming-soon" className="btn" download>
              Download CSV
            </a>
          </div>
        </div>

        {error && <p className="error">{error.message}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Signed up</th>
              </tr>
            </thead>
            <tbody>
              {signups?.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td>{new Date(s.created_at).toLocaleString("en-US", { timeZone: "America/Phoenix" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {signups?.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No signups yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
