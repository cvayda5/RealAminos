"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShippingDetails } from "@/types/database";

export default function PlaceTestOrderForm({ defaultEmail }: { defaultEmail?: string }) {
  const router = useRouter();
  const [productName, setProductName] = useState("BPC-157");
  const [size, setSize] = useState("5mg");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(54.99);

  // Pre-filled with plausible defaults so this stays a quick one-click test
  // form — the real checkout (CartDrawer) collects this from the customer
  // for real, but this manual form needs the same required fields since the
  // API now requires them for every order. Email defaults to the logged-in
  // account's real address (passed in from the page) rather than a fake
  // placeholder — a made-up address like test@example.com is a reserved,
  // non-deliverable domain and gets rejected by the confirmation-email
  // provider, which made this form look broken when it wasn't.
  const [shipping, setShipping] = useState<ShippingDetails>({
    name: "Test Customer",
    phone: "555-123-4567",
    email: defaultEmail ?? "",
    addressLine1: "123 Research Way",
    addressLine2: "",
    city: "Phoenix",
    state: "AZ",
    zip: "85001",
  });
  const [discountCode, setDiscountCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function updateShipping<K extends keyof ShippingDetails>(field: K, value: ShippingDetails[K]) {
    setShipping((s) => ({ ...s, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productName, size, qty, unitPrice }],
        shipping,
        discountCode: discountCode.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong placing the order.");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="productName">Product</label>
      <input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} />
      <label htmlFor="size">Size</label>
      <input id="size" value={size} onChange={(e) => setSize(e.target.value)} />
      <label htmlFor="qty">Qty</label>
      <input id="qty" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      <label htmlFor="unitPrice">Unit Price ($)</label>
      <input
        id="unitPrice"
        type="number"
        step="0.01"
        min={0}
        value={unitPrice}
        onChange={(e) => setUnitPrice(Number(e.target.value))}
      />

      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14, marginBottom: 4 }}>
        Shipping info (required — pre-filled with test data, edit as needed)
      </p>

      <label htmlFor="shipName">Full Name</label>
      <input id="shipName" required value={shipping.name} onChange={(e) => updateShipping("name", e.target.value)} />
      <label htmlFor="shipPhone">Phone</label>
      <input
        id="shipPhone"
        required
        value={shipping.phone}
        onChange={(e) => updateShipping("phone", e.target.value)}
      />
      <label htmlFor="shipEmail">Email</label>
      <input
        id="shipEmail"
        type="email"
        required
        value={shipping.email}
        onChange={(e) => updateShipping("email", e.target.value)}
      />
      <label htmlFor="shipAddress1">Address Line 1</label>
      <input
        id="shipAddress1"
        required
        value={shipping.addressLine1}
        onChange={(e) => updateShipping("addressLine1", e.target.value)}
      />
      <label htmlFor="shipAddress2">Address Line 2 (optional)</label>
      <input
        id="shipAddress2"
        value={shipping.addressLine2}
        onChange={(e) => updateShipping("addressLine2", e.target.value)}
      />
      <label htmlFor="shipCity">City</label>
      <input id="shipCity" required value={shipping.city} onChange={(e) => updateShipping("city", e.target.value)} />
      <label htmlFor="shipState">State</label>
      <input
        id="shipState"
        required
        value={shipping.state}
        onChange={(e) => updateShipping("state", e.target.value)}
      />
      <label htmlFor="shipZip">ZIP</label>
      <input id="shipZip" required value={shipping.zip} onChange={(e) => updateShipping("zip", e.target.value)} />

      <label htmlFor="discountCode">Discount Code (optional)</label>
      <input
        id="discountCode"
        placeholder="e.g. SAVE20"
        value={discountCode}
        onChange={(e) => setDiscountCode(e.target.value)}
      />

      <button className="btn" type="submit" style={{ marginTop: 14 }}>
        Place Test Order
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
