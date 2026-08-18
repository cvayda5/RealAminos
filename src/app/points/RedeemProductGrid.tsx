"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import type { ProductWithVariants } from "@/types/database";

// Same 10-points-per-dollar rounding /api/points/redeem-to-cart uses
// server-side — shown here purely so the button labels match what will
// actually be charged; the server never trusts this number, it recomputes
// it from the live price itself. This is a different rate than the
// 1-point-per-dollar customers earn on purchases.
function pointsCostFor(price: number) {
  return Math.max(1, Math.round(price * 10));
}

export default function RedeemProductGrid({
  products,
  initialBalance,
}: {
  products: ProductWithVariants[];
  initialBalance: number;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRedeem(variantId: string) {
    setRedeemingId(variantId);
    setError(null);

    const res = await fetch("/api/points/redeem-to-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId }),
    });
    const body = await res.json().catch(() => ({}));

    setRedeemingId(null);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong redeeming that vial.");
      return;
    }

    addItem({
      productId: variantId,
      productName: body.productName,
      size: body.size,
      unitPrice: 0,
      qty: 1,
      isReward: true,
      pointsCost: body.pointsCost,
      pointTransactionId: body.transactionId,
    });

    setBalance((b) => b - body.pointsCost);
    router.refresh();
  }

  return (
    <div>
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="product-grid">
        {products.map((product) => (
          <div className="pcard" key={product.id}>
            <div className="thumb">
              <span className="badge-purity">&gt;99%</span>
              <div className="cap" />
              <div className="vial" />
            </div>
            <div className="body">
              <div className="cat">{product.category}</div>
              <h3>{product.name}</h3>
              {product.cas_number && <div className="cas">CAS {product.cas_number}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {product.product_variants.map((v) => {
                  const cost = pointsCostFor(v.price);
                  const outOfStock = v.stock <= 0;
                  const canAfford = balance >= cost && !outOfStock;
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
                      <span>
                        {v.size} <span style={{ color: "var(--muted)", fontSize: 11.5 }}>(${v.price.toFixed(2)})</span>
                      </span>
                      <button
                        className="btn-add"
                        disabled={!canAfford || redeemingId === v.id}
                        onClick={() => handleRedeem(v.id)}
                        title={
                          outOfStock
                            ? "Out of stock — coming soon"
                            : canAfford
                              ? undefined
                              : `Need ${cost} points — you have ${balance}`
                        }
                        style={!canAfford ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                      >
                        {redeemingId === v.id ? "Adding…" : outOfStock ? "Out of Stock" : `${cost} pts`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
