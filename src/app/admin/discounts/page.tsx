import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DiscountCode } from "@/types/database";
import CreateDiscountCodeForm from "./CreateDiscountCodeForm";
import DiscountCodeRow from "./DiscountCodeRow";

export default async function AdminDiscountsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/discounts");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal discount code management — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  // Uses the service-role client the same way /admin/staff does — there's
  // no customer-facing RLS policy for reading this table at all (see
  // 0005_discount_codes.sql), so a normal session query would return
  // nothing here even for an admin. We already confirmed is_admin above.
  const admin = createAdminClient();
  const { data: codes, error } = await admin
    .from("discount_codes")
    .select("id, code, percent_off, is_active, created_at")
    .order("created_at", { ascending: false })
    .returns<DiscountCode[]>();

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Discount Codes</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 560 }}>
              Codes customers can enter at checkout for a percent-off discount. Deactivating a
              code stops it from being applied to new orders — it doesn&apos;t change any past
              order that already used it.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/admin/orders" className="btn btn-outline">
              ← Orders
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
          </div>
        </div>

        <div className="card">
          <strong>Create a new code</strong>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Codes are stored uppercase, so "save20" and "SAVE20" are the same code.
          </p>
          <CreateDiscountCodeForm />
        </div>

        {error && <p className="error">{error.message}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Percent Off</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {codes?.map((c) => (
                <DiscountCodeRow key={c.id} discountCode={c} />
              ))}
            </tbody>
          </table>
          {codes?.length === 0 && (
            <p style={{ color: "var(--muted)", padding: 16 }}>No discount codes yet — create one above.</p>
          )}
        </div>
      </div>
    </main>
  );
}
