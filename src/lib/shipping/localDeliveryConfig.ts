// Shared (client + server) settings for free local delivery. Kept separate
// from localDelivery.ts so the browser bundle doesn't pull in the ZIP table.

// We deliver ourselves, free, to Arizona addresses within this many miles
// (straight-line) of Surprise, AZ.
export const LOCAL_DELIVERY_RADIUS_MILES = 50;
export const LOCAL_DELIVERY_ORIGIN_LABEL = "Surprise, AZ";
export const LOCAL_DELIVERY_TIMEFRAME = "Same or next day";

// The shipping form's state field is free text, so accept the abbreviation
// or the full name, in any case.
export function isArizona(state: string | null | undefined): boolean {
  const s = (state ?? "").trim().toUpperCase();
  return s === "AZ" || s === "ARIZONA";
}
