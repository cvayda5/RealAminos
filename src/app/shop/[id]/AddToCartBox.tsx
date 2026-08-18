"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import type { ProductWithVariants } from "@/types/database";

export default function AddToCartBox({ product }: { product: ProductWithVariants }) {
  const { addItem } = useCart();
  // Default to the first size that's actually in stock, if any — landing on
  // an out-of-stock size by default would make an otherwise-available
  // product look unbuyable at a glance.
  const firstInStockIdx = product.product_variants.findIndex((v) => v.stock > 0);
  const [selectedIdx, setSelectedIdx] = useState(firstInStockIdx === -1 ? 0 : firstInStockIdx);
  const [qty, setQty] = useState(1);

  const variant = product.product_variants[selectedIdx];
  const outOfStock = !variant || variant.stock <= 0;

  function selectVariant(i: number) {
    setSelectedIdx(i);
    setQty(1);
  }

  function handleAdd() {
    if (!variant || outOfStock) return;
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
          {product.product_variants.map((v, i) => {
            const unavailable = v.stock <= 0;
            return (
              <div
                key={v.id}
                className={`size-opt ${i === selectedIdx ? "selected" : ""}`}
                onClick={() => selectVariant(i)}
                style={unavailable ? { opacity: 0.55 } : undefined}
              >
                {v.size} — {unavailable ? "Out of Stock" : `$${v.price.toFixed(2)}`}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pd-price">
        ${variant ? variant.price.toFixed(2) : "0.00"} <span>per unit, excl. shipping</span>
      </div>

      {outOfStock ? (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fdba74",
            color: "#7c2d12",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          Out of Stock — Coming Soon
        </div>
      ) : (
        <div className="qty-row">
          <div className="qty-box">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>–</button>
            <input type="text" value={qty} readOnly />
            <button onClick={() => setQty((q) => Math.min(variant.stock, q + 1))}>+</button>
          </div>
          <button className="btn" style={{ flex: 1 }} onClick={handleAdd}>
            Add to Cart
          </button>
        </div>
      )}
    </div>
  );
}
