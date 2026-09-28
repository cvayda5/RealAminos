"use client";

import { useEffect, useState } from "react";
import { isSiteSaleActive, SITE_SALE } from "@/lib/promotions/siteSale";

// Same reasoning as SiteGate: sessionStorage (not localStorage) so
// dismissing it covers the rest of that visit without needing to
// re-dismiss on every page, but a genuinely new visit shows it again —
// which is what you want for a promo banner (it should keep announcing
// itself to new visitors even after a returning one closed it once).
// Storage key is versioned to this specific sale (not the old BETA20 one)
// so a customer who dismissed the old banner months ago still sees this one.
const STORAGE_KEY = "realaminos_promo_sitewide20_dismissed";

function formatEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default function PromoBanner() {
  // Stays false for one tick while sessionStorage is checked client-side —
  // avoids flashing the banner open-then-closed on a page where it was
  // already dismissed this session.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  function handleDismiss() {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  // Reads the same SITE_SALE config every price on the site reads from
  // (see src/lib/promotions/siteSale.ts) — this banner disappears on its
  // own once `endsAt` passes, no separate step needed to take it down.
  if (!isSiteSaleActive() || !ready || dismissed) return null;

  return (
    <div className="promo-banner">
      <span className="promo-banner-text">
        <strong>Site-Wide Sale</strong> — prices are discounted storewide through{" "}
        {formatEndDate(SITE_SALE.endsAt)}, no code needed
      </span>
      <button
        type="button"
        className="promo-banner-close"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
      >
        ×
      </button>
    </div>
  );
}
