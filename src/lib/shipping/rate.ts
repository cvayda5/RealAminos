// Flat-rate shipping, estimated by zone from our Waddell, Arizona location.
// These are reasonable flat-rate stand-ins, not live carrier quotes — if a
// real-time carrier rate API (EasyPost, Shippo, etc.) gets wired in later,
// every caller here already just calls calculateShippingFee(subtotal,
// state), so swapping the internals out doesn't touch any calling code.

// "Spend this much on products (before any discount code), get free
// shipping." Based on the raw product subtotal rather than the
// post-discount total, so shipping eligibility doesn't shift around
// depending on which discount code was applied.
export const FREE_SHIPPING_THRESHOLD = 200;

// Rate charged when the order doesn't hit the free-shipping threshold,
// grouped by rough driving distance from Waddell, AZ. Zone 5 (AK/HI) is
// priced separately since those genuinely cost more via every real
// carrier, not just estimated to.
const ZONE_1_RATE = 6.99; // AZ and its closest neighbors
const ZONE_2_RATE = 8.99; // Mountain West / Pacific Northwest / south-central
const ZONE_3_RATE = 10.99; // Midwest and upper South
const ZONE_4_RATE = 12.99; // East Coast and Northeast
const ZONE_5_RATE = 18.99; // Alaska & Hawaii — not reachable by truck freight

const ZONE_1_STATES = ["AZ", "CA", "NV", "NM", "UT"];
const ZONE_2_STATES = ["CO", "TX", "ID", "OR", "WA", "WY", "MT", "OK", "KS", "NE"];
const ZONE_3_STATES = ["ND", "SD", "MN", "IA", "MO", "WI", "IL", "IN", "MI", "OH", "AR", "LA", "MS", "AL", "TN", "KY", "WV"];
const ZONE_4_STATES = ["NY", "FL", "MA", "GA", "PA", "NJ", "CT", "RI", "VT", "NH", "ME", "MD", "DE", "VA", "NC", "SC", "DC"];
const ZONE_5_STATES = ["AK", "HI"];

const RATE_BY_STATE: Record<string, number> = {};
ZONE_1_STATES.forEach((s) => (RATE_BY_STATE[s] = ZONE_1_RATE));
ZONE_2_STATES.forEach((s) => (RATE_BY_STATE[s] = ZONE_2_RATE));
ZONE_3_STATES.forEach((s) => (RATE_BY_STATE[s] = ZONE_3_RATE));
ZONE_4_STATES.forEach((s) => (RATE_BY_STATE[s] = ZONE_4_RATE));
ZONE_5_STATES.forEach((s) => (RATE_BY_STATE[s] = ZONE_5_RATE));

// The shipping form is a free-text input (see CartDrawer.tsx), so customers
// can type either a 2-letter abbreviation or the full state name in any
// case — this covers both instead of silently mis-pricing a typed-out name.
const FULL_NAME_TO_ABBREVIATION: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", "DISTRICT OF COLUMBIA": "DC",
  FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL",
  INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA",
  MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN",
  MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR",
  PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA",
  WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY",
};

// Falls back to the Zone 3 (mid-tier) rate for anything unrecognized —
// blank, a typo, or a non-US entry — so checkout never breaks over a
// shipping estimate; it just won't be as precise for that one order.
const FALLBACK_RATE = ZONE_3_RATE;

function normalizeState(state: string): string {
  const cleaned = state.trim().toUpperCase();
  if (cleaned.length === 2) return cleaned;
  return FULL_NAME_TO_ABBREVIATION[cleaned] ?? cleaned;
}

export function shippingRateForState(state: string): number {
  const abbreviation = normalizeState(state ?? "");
  return RATE_BY_STATE[abbreviation] ?? FALLBACK_RATE;
}

// The one function everything else calls. `productSubtotal` should be the
// raw product subtotal before any discount code is applied.
export function calculateShippingFee(productSubtotal: number, state: string): number {
  if (productSubtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return shippingRateForState(state);
}
