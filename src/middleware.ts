// Keeps the Supabase auth session cookie fresh on every request.
//
// There is no sitewide login gate — the storefront is public. Login is only
// required where it actually matters: at checkout (see CartDrawer.tsx), for
// "My Orders"/"Security" (/account/*), for the Points program, and for staff
// pages (/admin/*), each of which checks the session itself.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  await supabase.auth.getUser();

  // Remember which Google Ads click sent this visitor. Auto-tagging puts the
  // click ID on the landing URL (?gclid=…, or ?gbraid= / ?wbraid= for some
  // iPhone traffic). We keep our own first-party cookie so checkout can save it
  // on the order even when the visitor's browser blocks Google's tag — see
  // src/lib/ads/adClickId.ts. gclid is stored as-is; the other two are prefixed.
  const sp = request.nextUrl.searchParams;
  const found: [string, string][] = [
    ["", sp.get("gclid") ?? ""],
    ["gbraid:", sp.get("gbraid") ?? ""],
    ["wbraid:", sp.get("wbraid") ?? ""],
  ];
  const hit = found.find(([, id]) => /^[A-Za-z0-9_-]{6,255}$/.test(id));
  if (hit) {
    response.cookies.set({
      name: "ra_ad_click",
      value: hit[0] + hit[1],
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
