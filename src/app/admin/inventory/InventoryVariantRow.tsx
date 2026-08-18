"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, ProductVariant } from "@/types/database";

export default function InventoryVariantRow({
  product,
  variant,
}: {
  product: Product;
  variant: ProductVariant;
}) {
  const router = useRouter();
  const [stock, setStock] = useState(variant.stock);
  const [price, setPrice] = useState(variant.price);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(updates: { stock?: number; price?: number }) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/inventory/${variant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
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
        <strong>{product.name}</strong>
        {product.cas_number && (
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>CAS {product.cas_number}</div>
        )}
      </td>
      <td>{variant.size}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="admin-track-input"
            style={{ width: 90 }}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            onBlur={() => price !== variant.price && save({ price })}
            disabled={saving}
          />
        </div>
      </td>
      <td>
        <input
          type="number"
          min={0}
          step="1"
          className="admin-track-input"
          style={{ width: 90 }}
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
          onBlur={() => stock !== variant.stock && save({ stock })}
          disabled={saving}
        />
      </td>
      <td>
        {variant.stock > 0 ? (
          <span className="order-status-badge status-delivered">In Stock</span>
        ) : (
          <span className="order-status-badge status-processing">Out of Stock — Coming Soon</span>
        )}
      </td>
      <td>
        {error && <div className="error" style={{ fontSize: 12 }}>{error}</div>}
        {saving && <span style={{ fontSize: 12, color: "var(--muted)" }}>Saving…</span>}
      </td>
    </tr>
  );
}
