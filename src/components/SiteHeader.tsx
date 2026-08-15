"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader({ userEmail }: { userEmail: string | null }) {
  const { count, openDrawer } = useCart();

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
            <Link href="/">Home</Link>
            <Link href="/shop">Shop</Link>
            <Link href="/about">About</Link>
            <Link href="/affiliates">Affiliates</Link>
            <Link href="/points">Points</Link>
            <Link href="/lab">Lab Testing</Link>
            <Link href="/ruo-policy">RUO Policy</Link>
            <Link href="/faq">FAQ</Link>
          </nav>
          <div className="nav-actions">
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
            <button className="cart-btn" onClick={openDrawer}>
              Cart <span className="count">{count}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
