"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DiscountCode } from "@/types/database";

export default function DiscountCodeRow({ discountCode }: { discountCode: DiscountCode }) {
  const router = useRouter();
  const [percentOff, setPercentOff] = useState(discountCode.percent_off);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function savePercent() {
    if (percentOff === discountCode.percent_off) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/discount-codes/${discountCode.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentOff }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function toggleActive() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/discount-codes/${discountCode.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !discountCode.is_active }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/discount-codes/${discountCode.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleting(false);
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <tr>
      <td>
        <strong style={{ fontFamily: "var(--mono)" }}>{discountCode.code}</strong>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min={1}
            max={100}
            className="admin-track-input"
            style={{ width: 70 }}
            value={percentOff}
            onChange={(e) => setPercentOff(Number(e.target.value))}
            onBlur={savePercent}
          />
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>%</span>
        </div>
      </td>
      <td>
        {discountCode.is_active ? (
          <span className="order-status-badge status-delivered">Active</span>
        ) : (
          <span className="order-status-badge status-processing">Inactive</span>
        )}
      </td>
      <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
        {new Date(discountCode.created_at).toLocaleDateString()}
      </td>
      <td>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-save" onClick={toggleActive} disabled={saving || deleting}>
            {discountCode.is_active ? "Deactivate" : "Activate"}
          </button>
          <button
            className="admin-save"
            style={{ background: "#fee2e2", color: "#991b1b" }}
            onClick={remove}
            disabled={saving || deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
      </td>
    </tr>
  );
}
