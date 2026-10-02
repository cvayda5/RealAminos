// Keeps the Supabase auth session cookie fresh on every request, AND —
// as of the sitewide account gate — is what actually enforces that gate.
// Nothing on the site (the age/waiver popup, About, FAQ, RUO policy, /shop,
// all of it) renders for a logged-out visitor, with one deliberate
// exception: the homepage itself ("/" exactly — see isHomepage below),
// opened up so Google's bots can verify site-ownership/ads tags. Every
// other request without a real session gets bounced straight to /login
// before any page code runs. This runs at the edge, ahead of every page
// and layout, so it's the one place that actually can't be bypassed by a
// popup dismissal or a direct link the way the old client-side SiteGate
// could be.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The only things reachable without a logged-in account.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth", // Supabase's magic-link/email-OTP callback route
  // Kept open on purpose: someone locked out of their account (forgot
  // password, MFA issue, no account at all) still needs a way to reach a
  // human — gating this too would be a dead end with no way out. Say the
  // word if you want this closed as well.
  "/support",
];

// Hit by Whop's server, not a browser — there's no login cookie to check,
// and gating it would silently break real order fulfillment. The webhook's
// own signature check (see verifyWhopWebhook) is what actually secures it.
const PUBLIC_API_PREFIXES = ["/api/webhooks"];

// Google's "upload an HTML file" site-verification method works by having
// Google's OWN crawler (never logged in, no session cookie) fetch a file
// like /google65c972793efaa8dc.html straight from the root and check its
// contents. Same root cause as the meta-tag method failing earlier: any
// unauthenticated request to a path not on this allowlist gets redirected
// to /login by the check below, so Google's crawler was seeing the login
// page instead of the actual file (or the actual homepage's meta tag).
// Matches any /google<anything>.html at the root — covers this token and
// any future one from a different Google property without another
// middleware edit each time.
const GOOGLE_VERIFICATION_FILE = /^\/google[a-z0-9_-]+\.html$/i;

// The homepage itself, and ONLY the exact "/" path (not a prefix — "/shop",
// "/lab", etc. still fully gated) — opened up per chat so Google's various
// automated bots (Ads tag detection, Search Console, Merchant Center) can
// actually load a page and find what they're checking for, instead of
// always being redirected to /login and never seeing any <head> tag. This
// is a narrower version of the same problem as the verification file and
// the merchant feed: anything unauthenticated bounced to /login looks like
// a login page to an external checker, not the thing it came to verify.
// Safe to show logged-out, by design: src/app/page.tsx already only
// fetches/renders real product names, images, and prices when `user` is
// set — a logged-out visitor (or a bot) just sees generic marketing copy,
// trust badges, and the RUO disclaimer, never actual catalog/compound
// specifics. That's what keeps this consistent with "nothing about the
// research chemicals themselves is visible without an account."
function isHomepage(pathname: string): boolean {
  return pathname === "/";
}

function isPublicPath(pathname: string): boolean {
  if (GOOGLE_VERIFICATION_FILE.test(pathname)) return true;
  if (isHomepage(pathname)) return true;
  return [...PUBLIC_PATH_PREFIXES, ...PUBLIC_API_PREFIXES].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Touching getUser() is what actually triggers the token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
