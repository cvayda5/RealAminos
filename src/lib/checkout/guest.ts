// Guest checkout (no account) helpers shared by the three checkout routes.
import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// How many unpaid guest orders one email address may have open within the
// window before we ask them to wait. Stops a script from filling /admin/orders
// with junk orders, while leaving plenty of room for a real person who changes
// their payment method a couple of times.
const MAX_OPEN_GUEST_ORDERS = 5;
const WINDOW_MINUTES = 15;

/** Returns an error message to show the customer, or null if the guest may proceed. */
export async function guestCheckoutError(admin: SupabaseClient, email: string | undefined): Promise<string | null> {
  const e = (email ?? "").trim();
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) {
    return "Enter a valid email address so we can send your order confirmation.";
  }

  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .eq("shipping_email", e)
    .eq("status", "Awaiting Payment")
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_OPEN_GUEST_ORDERS) {
    return "You already have several unpaid orders open — please finish one, or wait a few minutes and try again.";
  }
  return null;
}
