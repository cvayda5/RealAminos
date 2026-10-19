// Keeps the Supabase auth session cookie fresh on every request AND enforces
// the sitewide login gate: any signed-out visitor who asks for a page is
// redirected to /login (with ?next= so they land back where they were after
// signing in). Only the pages listed in PUBLIC_PREFIXES stay open — login
// and account recovery, the legal/policy pages, and support.
//
// /api/* is deliberately NOT gated here: every API route checks the session
// itself (and returns its own 401), and a few must stay reachable by
// machines that can't log in — the Square/BTCPay webhooks and the Google
// Merchant product feed. robots.txt / sitemap.xml and static files stay
// open too (see PUBLIC_EXACT and the matcher below).
//
// To turn the gate off again, set NEXT_PUBLIC_LOGIN_GATE=off in Vercel and
// redeploy — no code change needed.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth", // /auth/callback — email confirmation + password reset links
  "/legal",
  "/privacy",
  "/refund-policy",
  "/ruo-policy",
  "/support",
  "/api", // each API route authenticates itself; webhooks/feed must stay open
];

const PUBLIC_EXACT = ["/robots.txt", "/sitemap.xml"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

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

  const gateOn = process.env.NEXT_PUBLIC_LOGIN_GATE !== "off";
  const { pathname, search } = request.nextUrl;

  if (gateOn && !user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Same-origin path only (never a full URL), so this can't be turned
    // into an open redirect.
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    // Carry over any cookies the session refresh just set.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  // Skip Next internals and static files (anything with a file extension —
  // logos, product photos, QR codes, fonts, video) so images on the login
  // page itself still load for signed-out visitors.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|woff|woff2|txt|xml)$).*)"],
};
