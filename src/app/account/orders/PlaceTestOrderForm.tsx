"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PlaceTestOrderForm() {
  const router = useRouter();
  const [productName, setProductName] = useState("BPC-157");
  const [size, setSize] = useState("5mg");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(54.99);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productName, size, qty, unitPrice }] }),
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

      <button className="btn" type="submit">Place Test Order</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
