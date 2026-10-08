import type { MetadataRoute } from "next";

// Served as real plain text at /robots.txt (src/middleware.ts lets this one
// path through the login gate — before that it returned the login page's
// HTML, which crawlers can't parse as robots directives).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/account", "/cart", "/checkout", "/auth", "/thank-you"],
      },
    ],
    sitemap: "https://shoprealaminos.com/sitemap.xml",
    host: "https://shoprealaminos.com",
  };
}
