"use client";

import { usePathname } from "next/navigation";

// The logged-out landing page (every signed-out request is redirected to
// /login by src/middleware.ts) is deliberately JUST the login form — no
// compliance strip, nav bar, logo, footer, or any other copy. Everything
// else (header, footer, cart drawer) is rendered by the root layout and
// passed in here so this one client component can decide, per path,
// whether to show it. Logged-in visitors and every other page get the
// normal site chrome.
export default function SiteChrome({
  isLoggedIn,
  header,
  footer,
  drawer,
  children,
}: {
  isLoggedIn: boolean;
  header: React.ReactNode;
  footer: React.ReactNode;
  drawer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare = !isLoggedIn && pathname === "/login";

  if (bare) {
    return <div className="login-bare">{children}</div>;
  }

  return (
    <>
      {header}
      {children}
      {footer}
      {drawer}
    </>
  );
}
