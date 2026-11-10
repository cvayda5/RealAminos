"use client";

import { useEffect, useState } from "react";
import type { FreeBacProduct } from "@/lib/promotions/freeBacWater";

// Fetched once per page load and shared — the cart drawer is mounted on every
// page, so this just asks the server which product is the free BAC Water.
let cached: Promise<FreeBacProduct | null> | null = null;

function load(): Promise<FreeBacProduct | null> {
  if (!cached) {
    cached = fetch("/api/promotions/free-bac", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.product as FreeBacProduct | null) ?? null)
      .catch(() => null);
  }
  return cached;
}

export function useFreeBacProduct() {
  const [product, setProduct] = useState<FreeBacProduct | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    load().then((p) => {
      if (!alive) return;
      setProduct(p);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { product, loaded };
}
