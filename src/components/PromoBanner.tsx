// Unused — the time-boxed site-wide sale banner this rendered was retired
// (see chat: struck-through "was" pricing is now a stored compare_at_price
// per variant, shown directly on product cards/pages, with no scheduled
// campaign or banner needed). No longer imported anywhere (removed from
// src/app/layout.tsx). Left as a harmless no-op rather than deleted because
// this was pushed live still importing the old siteSale.ts exports that no
// longer exist, which broke the Vercel build — safe to delete this file
// entirely whenever convenient.
export default function PromoBanner() {
  return null;
}
