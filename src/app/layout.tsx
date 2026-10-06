import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { CartProvider } from "@/lib/cart/CartContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SiteGate from "@/components/SiteGate";
import CartDrawer from "@/components/CartDrawer";

const SITE_URL = "https://shoprealaminos.com";
const SITE_TITLE = "RealAminos — Research Compounds";
const SITE_DESCRIPTION =
  "High-purity peptide and small-molecule research compounds. Research Use Only.";

export const metadata = {
  // metadataBase turns every relative URL below (canonical, og:image, ...)
  // into an absolute one.
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // "./" = "this page's own URL", resolved per page against metadataBase —
  // so the homepage self-references https://shoprealaminos.com/ and every
  // other page canonicalizes to itself (query strings like ?next= dropped).
  alternates: { canonical: "./" },
  // Open Graph + Twitter card: what Instagram/Reddit/iMessage/Slack show
  // when a link to the site is shared.
  openGraph: {
    type: "website",
    siteName: "RealAminos",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/email-logo.png", width: 867, height: 280, alt: "RealAminos" }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/email-logo.png"],
  },
  // Google Merchant Center site-ownership verification — Next.js's
  // `verification.google` field renders this as
  // <meta name="google-site-verification" content="..." /> in <head>, which
  // is exactly what Google's "HTML tag" verification method asks for. This
  // replaced an earlier Search Console verification tag. Don't remove this
  // once verification succeeds — Google keeps checking for it to confirm
  // continued ownership.
  verification: {
    google: "pl5NIzPyULxpK2wk5O5OWbUetE30gf8og4wd8xy_Wpg",
  },
};

// schema.org Organization markup (JSON-LD). Only facts that are already
// public on the site — no ratings, reviews, or phone numbers invented.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "RealAminos",
  url: SITE_URL,
  logo: `${SITE_URL}/email-logo.png`,
  email: "support@shoprealaminos.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Surprise",
    addressRegion: "AZ",
    addressCountry: "US",
  },
  sameAs: ["https://www.instagram.com/shoprealaminos/"],
};

// viewportFit: "cover" is what lets env(safe-area-inset-bottom) resolve to a
// real value on iPhone instead of 0 — used by the cart drawer's footer (see
// .drawer-foot in globals.css) so its buttons never sit flush against the
// bottom edge Safari's own chrome occupies.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Next.js aggressively caches fetch() responses by default, including the
// network call Supabase makes under the hood to check who's logged in. Left
// alone, that means the header can show a stale login state — logged in on
// a fresh visit when you're not, or still "Log Out" right after logging
// out. Forcing this layout to render fresh on every request (never cached,
// never reused between visitors) is what makes the header always reflect
// the real, current session instead of a snapshot from whenever Next.js
// last happened to check.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetched here (server-side, on every request) so the header knows
  // whether to show "Log In / Sign Up" or "My Orders / Security / Log Out"
  // without a client-side flash of the wrong state.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        {/* Google Ads conversion tag (gtag.js) — Google's own instructions
            say to place this immediately after <head>, so it goes first,
            ahead of the view-mode script below. Loads on every page via
            this root layout, the same way the view-mode script and the
            Google site-verification meta tag (see `metadata` above) do. */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-16694066039" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'AW-16694066039');`,
          }}
        />
        {/* Applies a saved "View as iPhone/Computer" choice (see
            ViewModeToggle.tsx) before the page paints, so a returning
            visitor who forced mobile view doesn't see a flash of the
            desktop layout first. Inline + synchronous on purpose — a
            regular React effect would run after the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=localStorage.getItem("ra-view-mode");if(m==="mobile")document.documentElement.classList.add("force-mobile");else if(m==="desktop")document.documentElement.classList.add("force-desktop");}catch(e){}`,
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <CartProvider>
          <SiteGate />
          <SiteHeader userEmail={user?.email ?? null} />
          {children}
          <SiteFooter />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
