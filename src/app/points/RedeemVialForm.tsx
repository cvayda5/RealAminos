"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShippingDetails } from "@/types/database";

export default function RedeemVialForm({
  products,
  defaultEmail,
  pointsPerFreeVial,
}: {
  products: string[];
  defaultEmail: string;
  pointsPerFreeVial: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState(products[0] ?? "");
  const [size, setSize] = useState("");
  const [shipping, setShipping] = useState<ShippingDetails>({
    name: "",
    phone: "",
    email: defaultEmail,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateShipping<K extends keyof ShippingDetails>(field: K, value: ShippingDetails[K]) {
    setShipping((s) => ({ ...s, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/points/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName, size, shipping }),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong redeeming your points.");
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="card">
        <strong>Redeemed!</strong>
        <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6 }}>
          Your free vial has been ordered — check My Orders for status, and watch your inbox for
          a confirmation email.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Redeem {pointsPerFreeVial} Points for a Free Vial
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <strong>Redeem for a Free Vial</strong>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, marginBottom: 14 }}>
        This spends {pointsPerFreeVial} points, all at once — there&apos;s no partial redemption.
      </p>

      <label htmlFor="redeemProduct">Which product would you like?</label>
      <select
        id="redeemProduct"
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
        style={{ display: "block", width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 4 }}
      >
        {products.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <label htmlFor="redeemSize">Preferred Size / Notes (optional)</label>
      <input
        id="redeemSize"
        placeholder="e.g. 5mg"
        value={size}
        onChange={(e) => setSize(e.target.value)}
      />

      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "14px 0 4px" }}>
        Shipping info (required)
      </p>

      <label htmlFor="redeemName">Full Name</label>
      <input id="redeemName" required value={shipping.name} onChange={(e) => updateShipping("name", e.target.value)} />
      <label htmlFor="redeemPhone">Phone</label>
      <input
        id="redeemPhone"
        required
        value={shipping.phone}
        onChange={(e) => updateShipping("phone", e.target.value)}
      />
      <label htmlFor="redeemEmail">Email</label>
      <input
        id="redeemEmail"
        type="email"
        required
        value={shipping.email}
        onChange={(e) => updateShipping("email", e.target.value)}
      />
      <label htmlFor="redeemAddress1">Address Line 1</label>
      <input
        id="redeemAddress1"
        required
        value={shipping.addressLine1}
        onChange={(e) => updateShipping("addressLine1", e.target.value)}
      />
      <label htmlFor="redeemAddress2">Address Line 2 (optional)</label>
      <input
        id="redeemAddress2"
        value={shipping.addressLine2}
        onChange={(e) => updateShipping("addressLine2", e.target.value)}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 2 }}>
          <label htmlFor="redeemCity">City</label>
          <input
            id="redeemCity"
            required
            value={shipping.city}
            onChange={(e) => updateShipping("city", e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="redeemState">State</label>
          <input
            id="redeemState"
            required
            value={shipping.state}
            onChange={(e) => updateShipping("state", e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="redeemZip">ZIP</label>
          <input
            id="redeemZip"
            required
            value={shipping.zip}
            onChange={(e) => updateShipping("zip", e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Redeeming…" : "Confirm Redemption"}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
