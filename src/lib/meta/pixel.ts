// Browser-side helper for the Meta Pixel (loaded by the snippet in the root
// layout). Every call is wrapped so a blocked or missing pixel — ad blockers
// are common — can never break the page.
//
// Privacy: events carry only the order/cart value, the currency and generic
// product IDs. No product names, no compound names, no customer details in
// the browser — Meta asks sellers not to send health-related information
// through its business tools, and a peptide's name could count as that.

type Fbq = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export function trackMeta(event: string, params: Record<string, unknown> = {}, eventId?: string): void {
  try {
    const fbq = typeof window !== "undefined" ? window.fbq : undefined;
    if (!fbq) return;
    if (eventId) fbq("track", event, params, { eventID: eventId });
    else fbq("track", event, params);
  } catch {
    // Tracking must never get in the way of the site.
  }
}
