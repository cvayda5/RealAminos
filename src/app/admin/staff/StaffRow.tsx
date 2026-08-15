"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";

export default function StaffRow({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: profile.email, isAdmin: !profile.is_admin }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <tr>
      <td>
        {profile.email}
        {isSelf && <span style={{ color: "var(--muted)", fontSize: 11.5 }}> (you)</span>}
      </td>
      <td>{new Date(profile.created_at).toLocaleDateString()}</td>
      <td>
        {profile.is_admin ? (
          <span className="order-status-badge status-delivered">Admin</span>
        ) : (
          <span className="order-status-badge status-processing">Customer</span>
        )}
      </td>
      <td>
        <button
          className="admin-save"
          onClick={toggle}
          disabled={saving || (isSelf && profile.is_admin)}
          title={isSelf && profile.is_admin ? "Have another admin remove your access instead" : undefined}
        >
          {saving ? "Saving…" : profile.is_admin ? "Remove Admin" : "Make Admin"}
        </button>
        {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
      </td>
    </tr>
  );
}
