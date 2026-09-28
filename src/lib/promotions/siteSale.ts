// Single source of truth for the site-wide promotional sale. Every place a
// price is shown (shop grid, product detail, cart) AND the actual amount
// charged at checkout (see resolveEffectivePrice() below, used server-side
// in both checkout routes) read this same config — there's no second place
// that has to be kept in sync by hand.
//
// To end the sale early, set `active` to false or move `endsAt` up — no
// other file needs to change.
export const SITE_SALE = {
  active: true,
  percentOff: 20,
  // Two-week window. Adjust to whatever the real start/end should be —
  // times are anchored to Arizona (which doesn't observe DST, so it's
  // always UTC-7) since that's where the business operates.
  startsAt: "2026-09-28T00:00:00-07:00",
  endsAt: "2026-10-12T23:59:59-07:00",
  displayLabel: "Site-Wide Sale",
} as const;

export function isSiteSaleActive(now: Date = new Date()): boolean {
  if (!SITE_SALE.active) return false;
  const t = now.getTime();
  return t >= new Date(SITE_SALE.startsAt).getTime() && t <= new Date(SITE_SALE.endsAt).getTime();
}

// Snaps a raw dollar figure to the nearest "normal retail" price ending in
// .99 (e.g. 36.792 -> 36.99, 30.392 -> 29.99) rather than just rounding to
// the nearest cent. Adding 1 cent first turns "nearest .99" into an
// ordinary round-to-the-nearest-whole-dollar problem.
function roundToNiceNinetyNine(n: number): number {
  return Math.round(n + 0.01) - 0.01;
}

export interface SitePriceDisplay {
  original: number;
  sale: number;
  active: boolean;
}

// What a single price should render as right now — used by ProductCard and
// the product detail page. When the sale isn't active, `sale` just equals
// `original` so callers can render unconditionally if they want to.
export function getSitePriceDisplay(price: number): SitePriceDisplay {
  const active = isSiteSaleActive();
  const sale = active ? roundToNiceNinetyNine(price * (1 - SITE_SALE.percentOff / 100)) : price;
  return { original: price, sale, active };
}

// What a line should actually be CHARGED right now for a given real DB
// price — the exact same number getSitePriceDisplay() shows, by
// construction, so a customer is never charged something different from
// what they saw on the product page. Used server-side in both checkout
// routes instead of trusting a client-sent unit price.
export function resolveEffectivePrice(price: number): number {
  return getSitePriceDisplay(price).sale;
}
