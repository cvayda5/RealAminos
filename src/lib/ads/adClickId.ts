import { cookies } from "next/headers";

// The Google tag stores the Google Ads click ID in a first-party cookie called
// `_gcl_aw` whenever a visitor arrives from an ad (auto-tagging adds ?gclid=…
// to the landing URL). Format: GCL.<unix-seconds>.<click id>. The cookie is not
// HttpOnly and lives on the shop's own domain, so the browser sends it along
// with every checkout request — nothing needs to be passed by the page.
//
// Returns the click ID of the most recent ad click, or null if the visitor
// didn't arrive from an ad (or blocked cookies). Server-only (reads the
// request's cookies); call it inside a route handler.
export function readAdClickId(): string | null {
  try {
    // Our own first-party cookie (set by middleware from the landing URL) is the
    // most reliable: it works even if the visitor's browser blocked Google's
    // tag. gclid is stored plain; gbraid / wbraid are stored with a prefix.
    const own = cookies().get("ra_ad_click")?.value;
    if (own && /^((gbraid|wbraid):)?[A-Za-z0-9_-]{6,255}$/.test(own)) return own;

    let best: { ts: number; id: string } | null = null;
    for (const c of cookies().getAll()) {
      // `_gcl_aw` plus the per-tag variants Google sometimes writes
      // (`_gcl_aw_<tag id>`).
      if (c.name !== "_gcl_aw" && !c.name.startsWith("_gcl_aw_")) continue;
      const parts = c.value.split(".");
      if (parts.length < 3 || parts[0] !== "GCL") continue;
      const ts = Number(parts[1]);
      const id = parts.slice(2).join(".");
      // Click IDs are URL-safe characters only; anything else isn't one.
      if (!/^[A-Za-z0-9_-]{6,255}$/.test(id)) continue;
      if (!best || ts > best.ts) best = { ts: Number.isFinite(ts) ? ts : 0, id };
    }
    return best?.id ?? null;
  } catch {
    return null;
  }
}
