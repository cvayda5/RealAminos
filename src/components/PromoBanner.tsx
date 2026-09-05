"use client";

import { useEffect, useState } from "react";

// Same reasoning as SiteGate: sessionStorage (not localStorage) so
// dismissing it covers the rest of that visit without needing to
// re-dismiss on every page, but a genuinely new visit shows it again —
// which is what you want for a promo banner (it should keep announcing
// itself to new visitors even after a returning one closed it once).
const STORAGE_KEY = "realaminos_promo_beta20_dismissed";

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

  if (!ready || dismissed) return null;

  return (
    <div className="promo-banner">
      <span className="promo-banner-text">
        <strong>20% OFF</strong> for our Beta Launch — use code <strong>BETA20</strong> at
        checkout
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
