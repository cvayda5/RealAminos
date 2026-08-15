"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import type { ProductWithVariants } from "@/types/database";

export default function AddToCartBox({ product }: { product: ProductWithVariants }) {
  const { addItem } = useCart();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [qty, setQty] = useState(1);

  const variant = product.product_variants[selectedIdx];

  function handleAdd() {
    if (!variant) return;
    addItem({
      productId: product.id,
      productName: product.name,
      size: variant.size,
      unitPrice: variant.price,
      qty,
    });
  }

  return (
    <div>
      <div>
        <strong style={{ fontSize: 13 }}>Select Size</strong>
        <div className="size-grid">
          {product.product_variants.map((v, i) => (
            <div
              key={v.id}
              className={`size-opt ${i === selectedIdx ? "selected" : ""}`}
              onClick={() => setSelectedIdx(i)}
            >
              {v.size} — ${v.price.toFixed(2)}
            </div>
          ))}
        </div>
      </div>

      <div className="pd-price">
        ${variant ? variant.price.toFixed(2) : "0.00"} <span>per unit, excl. shipping</span>
      </div>

      <div className="qty-row">
        <div className="qty-box">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))}>–</button>
          <input type="text" value={qty} readOnly />
          <button onClick={() => setQty((q) => q + 1)}>+</button>
        </div>
        <button className="btn" style={{ flex: 1 }} onClick={handleAdd}>
          Add to Cart
        </button>
      </div>
    </div>
  );
}
