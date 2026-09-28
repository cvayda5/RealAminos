// Keeps the Supabase auth session cookie fresh on every request, AND —
// as of the sitewide account gate — is what actually enforces that gate.
// Nothing on the site (marketing pages, the age/waiver popup, About, FAQ,
// RUO policy, /shop, all of it) renders for a logged-out visitor anymore;
// every request without a real session gets bounced straight to /login
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

function isPublicPath(pathname: string): boolean {
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
