// Quantity ("bulk") pricing — applies to every product, per cart line (one
// product + one size). Buy more of the same thing, each unit costs less:
//
//   1 unit   → full price
//   2 units  → 5% off each
//   3–9      → 10% off each
//   10+      → 20% off each
//
// This is the ONE place the tiers are defined. The product page cards, the
// cart, and the checkout API (/api/checkout/zelle) all import from here, so
// what the customer sees is always exactly what the server charges. The
// server never trusts a price from the browser — it recomputes with
// bulkUnitPrice() from the variant's real database price.
//
// Reward lines (items redeemed with points) are free and never discounted.

export interface BulkTier {
  minQty: number;
  percentOff: number;
}

// Must stay sorted by minQty, ascending.
export const BULK_TIERS: BulkTier[] = [
  { minQty: 2, percentOff: 5 },
  { minQty: 3, percentOff: 10 },
  { minQty: 10, percentOff: 20 },
];

/** Percent off each unit for a line of `qty` units (0 if no tier applies). */
export function getBulkPercent(qty: number): number {
  let percent = 0;
  for (const tier of BULK_TIERS) {
    if (qty >= tier.minQty) percent = tier.percentOff;
  }
  return percent;
}

/** The per-unit price after the bulk discount, rounded to the cent. */
export function bulkUnitPrice(unitPrice: number, qty: number): number {
  const percent = getBulkPercent(qty);
  if (percent === 0) return unitPrice;
  return Math.round(unitPrice * (100 - percent)) / 100;
}

/** The line total (discounted unit price × qty), rounded to the cent. */
export function bulkLineTotal(unitPrice: number, qty: number): number {
  return Math.round(bulkUnitPrice(unitPrice, qty) * qty * 100) / 100;
}
