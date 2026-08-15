"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateDiscountCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/discount-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, percentOff }),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong creating the code.");
      return;
    }

    setCode("");
    setPercentOff(10);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 180px" }}>
        <label htmlFor="newCode">Code</label>
        <input
          id="newCode"
          required
          placeholder="e.g. SAVE20"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </div>
      <div style={{ width: 120 }}>
        <label htmlFor="newPercentOff">% Off</label>
        <input
          id="newPercentOff"
          required
          type="number"
          min={1}
          max={100}
          value={percentOff}
          onChange={(e) => setPercentOff(Number(e.target.value))}
        />
      </div>
      <button className="btn" type="submit" disabled={saving} style={{ marginBottom: 0 }}>
        {saving ? "Creating…" : "Create Code"}
      </button>
      {error && <p className="error" style={{ width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
