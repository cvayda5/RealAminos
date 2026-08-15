"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";

// The cart is a slide-out drawer (see components/CartDrawer.tsx), reachable
// from the "Cart" button in the header on every page — same UX as the
// design prototype. This route exists only so a direct link to /cart (or a
// bookmark) still does something sensible: open the drawer and bounce home.
export default function CartRedirectPage() {
  const { openDrawer } = useCart();
  const router = useRouter();

  useEffect(() => {
    openDrawer();
    router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
