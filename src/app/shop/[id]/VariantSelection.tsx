"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ProductVariant } from "@/types/database";

// The selected size lives here, above both the photo carousel and the
// add-to-cart box, so picking a size can swap the vial photo (e.g. GLP-3 (RT)
// 20mg shows the 20mg vial) without the two sitting inside one component.
interface VariantSelection {
  variants: ProductVariant[];
  selectedIdx: number;
  setSelectedIdx: (i: number) => void;
}

const Ctx = createContext<VariantSelection | null>(null);

export function VariantSelectionProvider({
  variants,
  children,
}: {
  variants: ProductVariant[];
  children: ReactNode;
}) {
  // Default to the first size that's actually in stock, if any — landing on an
  // out-of-stock size by default would make an otherwise-available product
  // look unbuyable at a glance.
  const firstInStock = variants.findIndex((v) => v.stock > 0);
  const [selectedIdx, setSelectedIdx] = useState(firstInStock === -1 ? 0 : firstInStock);
  return <Ctx.Provider value={{ variants, selectedIdx, setSelectedIdx }}>{children}</Ctx.Provider>;
}

export function useVariantSelection(): VariantSelection {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVariantSelection must be used inside <VariantSelectionProvider>");
  return ctx;
}
