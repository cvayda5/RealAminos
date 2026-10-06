import { redirect } from "next/navigation";

// This was the landing page after a Whop card checkout. Card checkout has
// been removed, so anyone who still lands here (an old link, a bookmark) is
// just sent to their orders. Safe to delete this folder.
export default function CheckoutCompletePage() {
  redirect("/account/orders");
}
