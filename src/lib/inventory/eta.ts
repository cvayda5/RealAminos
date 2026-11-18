// Turns a variant's restock_eta (a YYYY-MM-DD date stored in the database)
// into the short label shown next to "Coming Soon", e.g. "ETA 2 weeks".
//
// Returns null — i.e. show nothing — when there is no date or the date has
// already passed, so a stale ETA never lingers on the site after the date it
// promised. Rounded to whole weeks, never below 1.
export function etaLabel(eta: string | null | undefined, now: Date = new Date()): string | null {
  if (!eta) return null;
  const target = new Date(`${eta}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const days = Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return null;
  const weeks = Math.max(1, Math.round(days / 7));
  return `ETA ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}
