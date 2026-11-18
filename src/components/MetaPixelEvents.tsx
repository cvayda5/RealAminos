"use client";

// Reports a Meta Pixel "PageView" on first load and on every in-site
// navigation (Next.js changes pages without a full reload, so the pixel's own
// automatic PageView would only ever fire once). The pixel itself — the
// fbq stub and fbevents.js — is loaded by the snippet in the root layout.
// Staff pages (/admin) are never reported.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackMeta } from "@/lib/meta/pixel";

export default function MetaPixelEvents() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    trackMeta("PageView");
  }, [pathname]);

  return null;
}
