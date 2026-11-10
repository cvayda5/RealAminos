"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FREE_BAC_THRESHOLD } from "@/lib/promotions/freeBacWater";

// Slim site-wide banner above the header: every $100 spent earns a free
// bacteriostatic water, redeemed in the cart at checkout (see
// lib/promotions/freeBacWater.ts). Hidden on /shop — the ad landing page is
// intentionally kept exactly as-is.
export default function PromoBanner() {
  const pathname = usePathname();
  if (pathname === "/shop" || pathname === "/shop/") return null;

  return (
    <div
      role="note"
      style={{
        background: "var(--orange, #f97316)",
        color: "#111",
        textAlign: "center",
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: 0.1,
        padding: "9px 16px",
        lineHeight: 1.35,
      }}
    >
      🎁 Free Bacteriostatic Water with every ${FREE_BAC_THRESHOLD} you spend — redeem it in your cart at checkout.{" "}
      <Link href="/shop/all" style={{ color: "#111", textDecoration: "underline", whiteSpace: "nowrap" }}>
        Shop now
      </Link>
    </div>
  );
}
