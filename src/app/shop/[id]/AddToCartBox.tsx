"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import type { ProductWithVariants } from "@/types/database";
import { getSitePriceDisplay } from "@/lib/promotions/siteSale";
import { getBulkPercent, bulkUnitPrice } from "@/lib/promotions/bulkPricing";

// The four quantity-pricing cards. The discount % comes from the one shared
// tier table (lib/promotions/bulkPricing.ts), so these can never disagree
// with what the cart and checkout actually charge.
const TIER_CARDS: { minQty: number; label: string; vials: number; badge?: string; badgeBg?: string }[] = [
  { minQty: 1, label: "1 UNIT", vials: 1 },
  { minQty: 2, label: "2 UNITS", vials: 2, badge: "MOST POPULAR", badgeBg: "#0f766e" },
  { minQty: 3, label: "3+ UNITS", vials: 3, badge: "BEST VALUE", badgeBg: "#f59e0b" },
  { minQty: 10, label: "10+ UNITS", vials: 3, badge: "VOLUME PRICING", badgeBg: "#111827" },
];

function Vial() {
  return (
    <svg width="22" height="34" viewBox="0 0 22 34" aria-hidden="true">
      <rect x="6" y="1" width="10" height="5" rx="1.5" fill="#f97316" />
      <rect x="4.5" y="5.5" width="13" height="3" rx="1" fill="#c2540c" />
      <rect x="3" y="8" width="16" height="24" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
      <rect x="3.8" y="17" width="14.4" height="8" fill="#ffedd5" />
    </svg>
  );
}

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

  // Which tier card is highlighted: the highest tier the current quantity
  // has reached. (A tier you can't reach — more units than are in stock —
  // is greyed out and unclickable.)
  const bulkPercent = getBulkPercent(qty);
  const currentTierMin = [...TIER_CARDS].reverse().find((c) => qty >= c.minQty)?.minQty ?? 1;

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
            const priceInfo = getSitePriceDisplay(v);
            return (
              <div
                key={v.id}
                className={`size-opt ${i === selectedIdx ? "selected" : ""}`}
                onClick={() => selectVariant(i)}
                style={unavailable ? { opacity: 0.55 } : undefined}
              >
                {v.size} —{" "}
                {unavailable ? (
                  "Out of Stock"
                ) : priceInfo.active ? (
                  <>
                    <span style={{ textDecoration: "line-through", opacity: 0.6, marginRight: 3 }}>
                      ${priceInfo.original.toFixed(2)}
                    </span>
                    <strong>${priceInfo.sale.toFixed(2)}</strong>
                  </>
                ) : (
                  `$${v.price.toFixed(2)}`
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pd-price">
        {variant && getSitePriceDisplay(variant).active ? (
          <>
            <span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: 16, marginRight: 8 }}>
              ${getSitePriceDisplay(variant).original.toFixed(2)}
            </span>
            <span style={{ color: "var(--ok)" }}>${getSitePriceDisplay(variant).sale.toFixed(2)}</span>
          </>
        ) : (
          `$${variant ? variant.price.toFixed(2) : "0.00"}`
        )}{" "}
        <span>per unit, excl. shipping</span>
      </div>

      {!outOfStock && variant && (
        <>
          <div className="tier-title">Quantity Pricing</div>
          <div className="tier-grid">
            {TIER_CARDS.map((card) => {
              const percent = getBulkPercent(card.minQty);
              const selected = card.minQty === currentTierMin;
              const unavailable = variant.stock < card.minQty;
              return (
                <button
                  key={card.minQty}
                  type="button"
                  className={`tier-card ${selected ? "selected" : ""}`}
                  disabled={unavailable}
                  onClick={() => setQty(card.minQty)}
                >
                  {card.badge && (
                    <span className="tier-badge" style={{ background: card.badgeBg }}>
                      {card.badge}
                    </span>
                  )}
                  <span className="tier-vials">
                    {Array.from({ length: card.vials }).map((_, n) => (
                      <Vial key={n} />
                    ))}
                  </span>
                  <span className="tier-text">
                    <b>{card.label}</b>
                    {percent > 0 && <span className="tier-off">{percent}% OFF</span>}
                    <span className="tier-each">${bulkUnitPrice(variant.price, card.minQty).toFixed(2)} ea</span>
                  </span>
                </button>
              );
            })}
          </div>
          {bulkPercent > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ok)", fontWeight: 700 }}>
              {bulkPercent}% bulk discount — ${bulkUnitPrice(variant.price, qty).toFixed(2)} per unit ($
              {(variant.price * qty - bulkUnitPrice(variant.price, qty) * qty).toFixed(2)} saved)
            </p>
          )}
        </>
      )}

      {outOfStock ? (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--warn-bg)",
            border: "1px solid var(--warn-line)",
            color: "var(--warn-text)",
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
