// Struck-through "was" pricing now comes from an explicit stored
// compare_at_price column on product_variants (see
// 0025_restore_original_prices.sql), not from a computed, time-boxed
// percent-off campaign. That's a deliberate change from the earlier
// SITE_SALE approach: computing "20% off the current price" at runtime
// turned out to be exactly the kind of thing that can silently drift from
// reality, and reversing a price increase mathematically doesn't reliably
// recover the real original (rounding during the increase is lossy, and
// some prices were touched up by hand afterward). A stored compare_at_price
// can't drift — it's either set to a real number or it isn't.
//
// This also means there's no schedule to maintain here: a variant either
// has a genuine higher compare_at_price right now, or it doesn't. If a
// time-boxed promo is wanted again later, that's a separate feature from
// this "was/now" display.

export interface VariantPricing {
  price: number;
  compare_at_price: number | null;
}

export interface SitePriceDisplay {
  // What to show struck through. Equals `sale` (nothing to cross out) when
  // there's no real compare_at_price.
  original: number;
  // The real, active/charged price — always just `price`.
  sale: number;
  // Whether there's a genuine higher compare_at_price to display.
  active: boolean;
}

export function getSitePriceDisplay(variant: VariantPricing): SitePriceDisplay {
  const hasCompareAt = variant.compare_at_price != null && variant.compare_at_price > variant.price;
  return {
    original: hasCompareAt ? (variant.compare_at_price as number) : variant.price,
    sale: variant.price,
    active: hasCompareAt,
  };
}
