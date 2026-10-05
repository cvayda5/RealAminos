// Keeps the Supabase auth session cookie fresh on every request, AND —
// as of the sitewide account gate — is what actually enforces that gate.
// Nothing on the site (marketing pages, the homepage, the age/waiver popup,
// About, FAQ, RUO policy, /shop, all of it) renders for a logged-out
// visitor — every request without a real session gets bounced straight to
// /login before any page code runs. This runs at the edge, ahead of every
// page and layout, so it's the one place that actually can't be bypassed by
// a popup dismissal or a direct link the way the old client-side SiteGate
// could be.
//
// A homepage exception existed here briefly (opened up "/" so Google's bots
// could verify ads/search-console tags) and was reverted per chat — the
// strict "nothing visible without an account" rule wins over Google's
// tooling working, so Google's tag/verification detection will likely keep
// failing until/unless that tradeoff is revisited.
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
  // Privacy Policy — a legal page with nothing about the catalog on it, and
  // Google/Meta ad review needs to be able to reach one without an account.
  "/privacy",
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

// Crawler plumbing, not content: robots.txt and sitemap.xml must come back as
// real plain-text/XML. Behind the gate they were redirected to /login and
// returned the login page's HTML instead (flagged by the SEO audit). Both
// only list/permit generic pages — see src/app/robots.ts and sitemap.ts.
const CRAWLER_FILES = ["/robots.txt", "/sitemap.xml"];

function isPublicPath(pathname: string): boolean {
  if (GOOGLE_VERIFICATION_FILE.test(pathname)) return true;
  if (CRAWLER_FILES.includes(pathname)) return true;
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
