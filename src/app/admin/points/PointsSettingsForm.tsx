"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PointsSettingsForm({ pointsPerFreeVial }: { pointsPerFreeVial: number }) {
  const router = useRouter();
  const [value, setValue] = useState(pointsPerFreeVial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value === pointsPerFreeVial) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/points-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointsPerFreeVial: value }),
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
      <div>
        <label htmlFor="pointsPerFreeVial">Points required for a free vial</label>
        <input
          id="pointsPerFreeVial"
          type="number"
          min={1}
          style={{ width: 140 }}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onBlur={save}
        />
      </div>
      {saving && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Saving…</span>}
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
