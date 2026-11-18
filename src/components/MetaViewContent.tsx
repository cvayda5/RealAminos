"use client";

// Fires the Meta Pixel "ViewContent" event once when a product page opens.
// Only the product's ID and its lowest price are sent — never its name.
import { useEffect } from "react";
import { trackMeta } from "@/lib/meta/pixel";

export default function MetaViewContent({ productId, value }: { productId: string; value: number }) {
  useEffect(() => {
    trackMeta("ViewContent", {
      content_type: "product",
      content_ids: [productId],
      value,
      currency: "USD",
    });
  }, [productId, value]);

  return null;
}
