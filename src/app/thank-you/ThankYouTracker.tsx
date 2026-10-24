"use client";

// Client half of /thank-you. Two jobs:
//
//  1. Report the Google Ads "Purchase" conversion — once, and only when the
//     order is actually paid. (The Google tag itself, gtag.js AW-16694066039,
//     is loaded on every page by the root layout, so this only reports the
//     event.) transaction_id = the order number lets Google drop a duplicate
//     report of the same order, and a localStorage flag stops a refresh or
//     revisit of this page from re-sending it.
//
//     Enhanced conversions: the buyer's details (email, and phone / name /
//     address when we have them) are handed to the Google tag just before the
//     event. The tag hashes them (SHA-256) in the browser — we never send the
//     plain values — and Google uses the hash to match the sale to the ad click
//     when the click ID didn't survive (different browser, in-app browser,
//     cookies blocked).
//
//  2. While the order is still "Awaiting Payment" (e.g. a Bitcoin customer who
//     just came back from BTCPay before the payment confirmed), re-check the
//     order every few seconds so the page flips to the real thank-you — and
//     fires the conversion — on its own the moment the payment lands.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Purchase conversion actions — one per Google Ads account. The Google tag
// for each account (AW-…) is configured in the root layout.
const CONVERSION_SEND_TO = [
  "AW-16694066039/oB4GCIfOm5UdEPf2rJg-",
  "AW-18518215793/5YXaCOGezqEdEPGYlv5E",
];
const POLL_MS = 8000;

interface Buyer {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface Props {
  orderNumber: string;
  value: number;
  paid: boolean;
  buyer?: Buyer;
}

// Build the enhanced-conversions payload from whatever we have. Phone must be
// E.164 (+1XXXXXXXXXX for US numbers); anything that doesn't look like a phone
// number is dropped rather than sent wrong.
function userData(b?: Buyer): Record<string, unknown> | null {
  if (!b) return null;
  const data: Record<string, unknown> = {};
  const email = b.email?.trim().toLowerCase();
  if (email) data.email = email;

  const digits = (b.phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) data.phone_number = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) data.phone_number = `+${digits}`;

  const parts = (b.name ?? "").trim().split(/\s+/).filter(Boolean);
  const address: Record<string, string> = {};
  if (parts.length) address.first_name = parts[0].toLowerCase();
  if (parts.length > 1) address.last_name = parts.slice(1).join(" ").toLowerCase();
  if (b.street?.trim()) address.street = b.street.trim().toLowerCase();
  if (b.city?.trim()) address.city = b.city.trim().toLowerCase();
  if (b.state?.trim()) address.region = b.state.trim().toLowerCase();
  if (b.zip?.trim()) address.postal_code = b.zip.trim();
  if (Object.keys(address).length) {
    address.country = "US";
    data.address = address;
  }
  return Object.keys(data).length ? data : null;
}

export default function ThankYouTracker({ orderNumber, value, paid, buyer }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!paid) {
      const id = setInterval(() => router.refresh(), POLL_MS);
      return () => clearInterval(id);
    }

    const key = `realaminos_purchase_conversion_${orderNumber}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // Storage can be blocked — fall through; transaction_id still dedupes.
    }

    try {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
      if (!gtag) return;
      const ud = userData(buyer);
      if (ud) gtag("set", "user_data", ud);
      for (const sendTo of CONVERSION_SEND_TO) {
        gtag("event", "conversion", {
          send_to: sendTo,
          value,
          currency: "USD",
          transaction_id: orderNumber,
        });
      }
      try {
        localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    } catch {
      // Tracking must never get in the way of the page.
    }
  }, [paid, orderNumber, value, router, buyer]);

  return null;
}
