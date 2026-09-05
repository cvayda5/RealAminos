import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { CartProvider } from "@/lib/cart/CartContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SiteGate from "@/components/SiteGate";
import CartDrawer from "@/components/CartDrawer";
import PromoBanner from "@/components/PromoBanner";

export const metadata = {
  title: "RealAminos — Research Compounds",
  description: "High-purity peptide and small-molecule research compounds. Research Use Only.",
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
          <SiteGate />
          <PromoBanner />
          <SiteHeader userEmail={user?.email ?? null} />
          {children}
          <SiteFooter />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
