"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductWithVariants } from "@/types/database";
import VariantPriceInput from "./VariantPriceInput";

export default function ProductRow({
  product,
  categories,
}: {
  product: ProductWithVariants;
  categories: string[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(product.category);
  const [description, setDescription] = useState(product.description ?? "");
  const [lotNumber, setLotNumber] = useState(product.lot_number ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedVariants = [...product.product_variants].sort((a, b) => a.sort_order - b.sort_order);

  async function patch(form: FormData) {
    setError(null);
    const res = await fetch(`/api/admin/products/${product.id}`, { method: "PATCH", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveCategory() {
    if (category === product.category) return;
    setSaving(true);
    const form = new FormData();
    form.set("category", category);
    await patch(form);
    setSaving(false);
  }

  async function saveDescription() {
    if (description === (product.description ?? "")) return;
    setSaving(true);
    const form = new FormData();
    form.set("description", description);
    await patch(form);
    setSaving(false);
  }

  async function saveLotNumber() {
    if (lotNumber === (product.lot_number ?? "")) return;
    setSaving(true);
    const form = new FormData();
    form.set("lotNumber", lotNumber);
    await patch(form);
    setSaving(false);
  }

  async function handleImageChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("image", file);
    await patch(form);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove() {
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              background: "linear-gradient(135deg,#fff7ed,#ffedd5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <span style={{ fontSize: 10, color: "var(--muted)" }}>No photo</span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={handleImageChange}
            disabled={uploading}
            style={{ fontSize: 10.5, width: 130 }}
          />
          {uploading && <span style={{ fontSize: 11, color: "var(--muted)" }}>Uploading…</span>}
        </div>
      </td>
      <td>
        <strong>{product.name}</strong>
        {product.cas_number && (
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>CAS {product.cas_number}</div>
        )}
      </td>
      <td>
        <input
          list={`categories-${product.id}`}
          className="admin-track-input"
          style={{ width: 170 }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={saveCategory}
          disabled={saving}
        />
        <datalist id={`categories-${product.id}`}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </td>
      <td>
        <input
          className="admin-track-input"
          style={{ width: 110, fontFamily: "var(--mono)" }}
          placeholder="—"
          value={lotNumber}
          onChange={(e) => setLotNumber(e.target.value)}
          onBlur={saveLotNumber}
          disabled={saving}
        />
      </td>
      <td style={{ maxWidth: 260 }}>
        <textarea
          className="admin-track-input"
          style={{ width: "100%", minWidth: 220, fontFamily: "inherit", fontSize: 12.5 }}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
          disabled={saving}
        />
      </td>
      <td>
        {sortedVariants.length > 0 ? (
          sortedVariants.map((v) => <VariantPriceInput key={v.id} variant={v} />)
        ) : (
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>No sizes</span>
        )}
      </td>
      <td>
        <button
          className="admin-save"
          style={{ background: "#fee2e2", color: "#991b1b" }}
          onClick={remove}
          disabled={saving || deleting || uploading}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        {error && <div className="error" style={{ marginTop: 6, fontSize: 12 }}>{error}</div>}
      </td>
    </tr>
  );
}
