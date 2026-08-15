"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AffiliateSignup } from "@/types/database";

export default function AffiliateSignupRow({ signup }: { signup: AffiliateSignup }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleContacted() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/affiliate-signups/${signup.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacted: !signup.contacted }),
    });
    const body = await res.json().catch(() => ({}));
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
        {signup.first_name} {signup.last_name}
      </td>
      <td>
        <a
          href={`https://instagram.com/${signup.instagram_handle}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--orange-dark)", fontWeight: 700 }}
        >
          @{signup.instagram_handle}
        </a>
      </td>
      <td>
        <a href={`mailto:${signup.email}`}>{signup.email}</a>
      </td>
      <td>
        <strong style={{ fontFamily: "var(--mono)" }}>{signup.preferred_code}</strong>
      </td>
      <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
        {new Date(signup.created_at).toLocaleDateString()}
      </td>
      <td>
        {signup.contacted ? (
          <span className="order-status-badge status-delivered">Contacted</span>
        ) : (
          <span className="order-status-badge status-processing">New</span>
        )}
      </td>
      <td>
        <button className="admin-save" onClick={toggleContacted} disabled={saving}>
          {saving ? "Saving…" : signup.contacted ? "Mark New" : "Mark Contacted"}
        </button>
        {error && (
          <div className="error" style={{ marginTop: 6 }}>
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}
