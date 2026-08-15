"use client";

// Client-side shopping cart. This runs in the customer's browser only — it
// has nothing to do with the database until checkout, when its contents get
// POSTed to /api/orders. Saved to localStorage so a cart survives a page
// refresh (this is a real production site, not a design-tool preview, so
// browser storage is the normal, correct choice here).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CartLine } from "@/types/database";

interface CartContextValue {
  items: CartLine[];
  addItem: (line: CartLine) => void;
  // Takes the whole line (not just productId/size) because a reward line
  // needs its pointTransactionId to know which reservation to refund —
  // two reward lines can otherwise share the same productId/size (e.g. the
  // same vial redeemed twice) and would collide on that pair alone.
  removeItem: (line: CartLine) => void;
  clear: () => void;
  subtotal: number;
  count: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

// Identifies a cart line uniquely. A reward line's reservation id is
// already unique per redemption, so it's used as-is; a normal line falls
// back to productId+size, which is what lets two adds of the same
// product/size merge into one line with addItem below.
function lineKey(line: Pick<CartLine, "productId" | "size" | "pointTransactionId">) {
  return line.pointTransactionId ?? `${line.productId}::${line.size}`;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "realaminos_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  // Load whatever was saved from a previous visit, once, on first render.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Corrupt or blocked storage — just start with an empty cart.
    }
    setHydrated(true);
  }, []);

  // Save on every change, after the initial load above has happened.
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  function addItem(line: CartLine) {
    setItems((prev) => {
      // Reward lines never merge — each redemption is its own reservation
      // (its own pointTransactionId) even if it happens to be the same
      // product/size as another line already in the cart.
      if (!line.isReward) {
        const existing = prev.find((i) => !i.isReward && i.productId === line.productId && i.size === line.size);
        if (existing) {
          return prev.map((i) => (i === existing ? { ...i, qty: i.qty + line.qty } : i));
        }
      }
      return [...prev, line];
    });
    setDrawerOpen(true);
  }

  // Removing a reward line refunds its reserved points server-side before
  // dropping it from local state — best-effort: if the refund call fails
  // (e.g. a network blip), the line is still removed so the cart UI never
  // gets stuck, but the points stay reserved server-side until support can
  // sort it out (logged to the console for that reason).
  async function removeItem(line: CartLine) {
    if (line.isReward && line.pointTransactionId) {
      try {
        const res = await fetch("/api/points/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: line.pointTransactionId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error("Refunding points failed:", body.error ?? res.status);
        }
      } catch (err) {
        console.error("Refunding points threw:", err);
      }
    }
    setItems((prev) => prev.filter((i) => lineKey(i) !== lineKey(line)));
  }

  function clear() {
    setItems([]);
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clear,
        subtotal,
        count,
        isDrawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
