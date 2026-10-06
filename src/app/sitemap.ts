import type { MetadataRoute } from "next";

// Static pages. Product pages (/shop/<id>) aren't listed here yet — add them
// from the products table if you want them in the sitemap.
const BASE = "https://shoprealaminos.com";
const PATHS = [
  "/",
  "/shop",
  "/lab",
  "/about",
  "/faq",
  "/affiliates",
  "/points",
  "/support",
  "/ruo-policy",
  "/refund-policy",
  "/legal",
  "/privacy",
  "/login",
  "/signup",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${BASE}${path === "/" ? "" : path}` }));
}
