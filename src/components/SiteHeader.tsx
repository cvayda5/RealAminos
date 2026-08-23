"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { createClient } from "@/lib/supabase/client";

// Every link that lives in the desktop nav.primary bar — reused for the
// mobile dropdown so the two never drift out of sync with each other.
const PRIMARY_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/affiliates", label: "Affiliates" },
  { href: "/points", label: "Points" },
  { href: "/lab", label: "Lab Testing" },
  { href: "/ruo-policy", label: "RUO Policy" },
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
];

export default function SiteHeader({ userEmail }: { userEmail: string | null }) {
  const { count, openDrawer } = useCart();
  // Below 980px, nav.primary is hidden by CSS entirely — this is what
  // replaces it, since a website with no way to navigate on a phone (the
  // previous behavior) isn't acceptable just because there's no room for
  // the full horizontal link bar.
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full page load on purpose — same reason as the login page. This
    // guarantees the header re-checks the (now cleared) session fresh from
    // the server instead of relying on client-side navigation to notice.
    window.location.href = "/";
  }

  return (
    <>
      <div className="compliance-strip">
        <strong>FOR LABORATORY RESEARCH USE ONLY.</strong>&nbsp; Not for human or animal
        consumption. Not a drug, food, dietary supplement, or cosmetic.
      </div>
      <header className="site">
        <div className="nav-wrap">
          <Link href="/" className="logo">
            <div className="mark">ra</div>
            <div className="name">
              real<span>aminos</span>
            </div>
          </Link>
          <nav className="primary">
            {PRIMARY_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            {/* Hidden below 980px (see globals.css) — the same links show
                inside the mobile dropdown instead. */}
            <div className="nav-actions-desktop">
              {userEmail ? (
                <>
                  <Link href="/account/orders">My Orders</Link>
                  <Link href="/account/security">Security</Link>
                  <button className="link-btn" onClick={handleLogout} style={{ fontSize: 13.5 }}>
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login">Log In</Link>
                  <Link href="/signup">Sign Up</Link>
                </>
              )}
            </div>
            <button className="cart-btn" onClick={openDrawer}>
              Cart <span className="count">{count}</span>
            </button>
            <button
              className="menu-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? (
                <span style={{ fontSize: 20, lineHeight: 1 }}>✕</span>
              ) : (
                <>
                  <span />
                  <span />
                  <span />
                </>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="mobile-menu">
            {PRIMARY_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={closeMenu}>
                {l.label}
              </Link>
            ))}
            <div className="mobile-menu-section-label">Account</div>
            {userEmail ? (
              <>
                <Link href="/account/orders" onClick={closeMenu}>
                  My Orders
                </Link>
                <Link href="/account/security" onClick={closeMenu}>
                  Security
                </Link>
                <button
                  className="link-btn"
                  onClick={() => {
                    closeMenu();
                    handleLogout();
                  }}
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={closeMenu}>
                  Log In
                </Link>
                <Link href="/signup" onClick={closeMenu}>
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        )}
      </header>
    </>
  );
}
