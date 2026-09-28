import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { CartProvider } from "@/lib/cart/CartContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SiteGate from "@/components/SiteGate";
import CartDrawer from "@/components/CartDrawer";

export const metadata = {
  title: "RealAminos — Research Compounds",
  description: "High-purity peptide and small-molecule research compounds. Research Use Only.",
  // Google site-ownership verification tags — Next.js's `verification.google`
  // field accepts a string OR an array, rendering one
  // <meta name="google-site-verification" content="..." /> per entry in
  // <head>, which is exactly what Google's "HTML tag" verification method
  // asks for. Two entries here because two separate Google properties each
  // asked for their own tag (Search Console, then Merchant Center's own
  // "claim your online store" flow) — don't remove either once verified,
  // Google keeps checking for them to confirm continued ownership.
  verification: {
    google: [
      "vsZWh8tQYtTxasYo6Ds0EHsM6YaGurBwnrm4TW9cEes",
      "pl5NIzPyULxpK2wk5O5OWbUetE30gf8og4wd8xy_Wpg",
    ],
  },
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
        <CartProvider>
          <SiteGate isLoggedIn={!!user} />
          <SiteHeader userEmail={user?.email ?? null} />
          {children}
          <SiteFooter />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
