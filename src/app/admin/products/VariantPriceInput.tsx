"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductVariant } from "@/types/database";

// One size/price line for a product, editable right here on the Products
// page. Saves through the same /api/admin/inventory/[variantId] endpoint
// the Inventory page already uses — stock still lives there, this is just
// price, surfaced here too so staff don't have to jump pages for the
// common case of "this product's price changed."
export default function VariantPriceInput({ variant }: { variant: ProductVariant }) {
  const router = useRouter();
  const [price, setPrice] = useState(variant.price);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (price === variant.price) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/inventory/${variant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
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
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: "var(--muted)", width: 40, flexShrink: 0 }}>{variant.size}</span>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>$</span>
      <input
        type="number"
        min={0}
        step="0.01"
        className="admin-track-input"
        style={{ width: 76 }}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        onBlur={save}
        disabled={saving}
      />
      {saving && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Saving…</span>}
      {error && <span className="error" style={{ fontSize: 10.5 }}>{error}</span>}
    </div>
  );
}
