import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETING_TEMPLATES } from "@/lib/email/marketing/templates";
import { fetchRecipients, getOpenCampaign, getSettings, type MarketingCampaign } from "@/lib/email/marketing/campaigns";
import { postalAddress } from "@/lib/email/marketing/sendMarketing";
import EmailMarketingControls from "./EmailMarketingControls";

export const dynamic = "force-dynamic";

export default async function AdminEmailMarketingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/email-marketing");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    return (
      <main className="site-main">
        <div className="admin-lock">
          <h3>Staff Admin Login</h3>
          <p>Internal email marketing — not linked from customer-facing pages.</p>
          <p style={{ fontSize: 13.5 }}>
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t
            marked as an admin.
          </p>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const settings = await getSettings(admin);
  const open = await getOpenCampaign(admin);
  const { data: campaigns, error } = await admin
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(15)
    .returns<MarketingCampaign[]>();
  const { count: unsubCount } = await admin.from("marketing_unsubscribes").select("*", { count: "exact", head: true });

  let recipientCount: number | null = null;
  try {
    recipientCount = (await fetchRecipients(admin)).length;
  } catch {
    recipientCount = null;
  }

  const nextTemplate = MARKETING_TEMPLATES[settings.next_template % MARKETING_TEMPLATES.length];

  return (
    <main className="site-main">
      <div className="wrap" style={{ maxWidth: 800 }}>
        <div className="admin-bar">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Email Marketing</h1>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, maxWidth: 560 }}>
              One email to everyone who signed up (accounts, Coming Soon and affiliate signups), every{" "}
              {settings.interval_hours} hours. {recipientCount ?? "?"} people on the list, {unsubCount ?? 0} unsubscribed.
              Next in the rotation: <strong>{nextTemplate.subject}</strong>
            </p>
          </div>
          <Link href="/admin/orders" className="btn btn-outline">
            ← Orders
          </Link>
        </div>

        <EmailMarketingControls
          enabled={settings.enabled}
          intervalHours={settings.interval_hours}
          sendHour={settings.send_hour_az}
          hasOpenCampaign={!!open}
          addressSet={!!postalAddress()}
          templates={MARKETING_TEMPLATES.map((t) => ({ key: t.key, subject: t.subject }))}
        />

        {error && <p className="error">{error.message}</p>}

        <h3 style={{ margin: "22px 0 8px" }}>Recent sends</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Started (Arizona)</th>
                <th>Email</th>
                <th>Sent to</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns?.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.created_at).toLocaleString("en-US", { timeZone: "America/Phoenix" })}</td>
                  <td>{c.subject}</td>
                  <td>{c.sent_count}</td>
                  <td>{c.completed_at ? "Done" : "Sending…"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {campaigns?.length === 0 && <p style={{ color: "var(--muted)", padding: 16 }}>Nothing sent yet.</p>}
        </div>
      </div>
    </main>
  );
}
