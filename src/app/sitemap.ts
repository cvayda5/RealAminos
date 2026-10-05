import type { MetadataRoute } from "next";

// Only pages a signed-out crawler can actually reach right now. Everything
// else (home, shop, products, FAQ, lab, ...) is behind the account gate (see
// src/middleware.ts) and just redirects to /login for a bot — listing
// redirecting URLs in a sitemap gets them flagged as errors. If/when the
// public pages are opened up, add them back here (and products, from the
// products table).
const BASE = "https://shoprealaminos.com";
const PATHS = ["/login", "/signup", "/support", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${BASE}${path === "/" ? "" : path}` }));
}
