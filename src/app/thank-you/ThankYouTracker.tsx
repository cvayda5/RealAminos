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
//  2. While the order is still "Awaiting Payment" (e.g. a Bitcoin customer who
//     just came back from BTCPay before the payment confirmed), re-check the
//     order every few seconds so the page flips to the real thank-you — and
//     fires the conversion — on its own the moment the payment lands.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CONVERSION_SEND_TO = "AW-16694066039/oB4GCIfOm5UdEPf2rJg-";
const POLL_MS = 8000;

interface Props {
  orderNumber: string;
  value: number;
  paid: boolean;
}

export default function ThankYouTracker({ orderNumber, value, paid }: Props) {
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
      gtag("event", "conversion", {
        send_to: CONVERSION_SEND_TO,
        value,
        currency: "USD",
        transaction_id: orderNumber,
      });
      try {
        localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    } catch {
      // Tracking must never get in the way of the page.
    }
  }, [paid, orderNumber, value, router]);

  return null;
}
