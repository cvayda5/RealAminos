import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";

// Public product feed for Google Merchant Center — set this URL up under
// Merchant Center > Products > Feeds > add feed > "Scheduled fetch":
//   https://shoprealaminos.com/api/merchant-feed
// Google will re-fetch it on whatever schedule you pick there (daily is
// plenty), so price/stock changes made in /admin/products and
// /admin/inventory show up in Shopping automatically — nothing needs to be
// re-uploaded by hand.
//
// One <item> per size (product_variants row), not per product, since price
// and availability are set per size — Google expects each purchasable
// offer to have its own id/price/availability rather than one entry per
// product page.
//
// Deliberately excludes any product with no photo (image_url null) —
// Google requires an image_link, and a placeholder/no-image entry is more
// likely to get that item disapproved than just leaving it out of the feed
// until a real product photo exists for it.
//
// This is a public, read-only, unauthenticated endpoint by design (same as
// the storefront itself) — it only ever returns what's already public on
// the shop pages, just reshaped into the feed format Google wants.
export const dynamic = "force-dynamic";

const SITE_URL = "https://shoprealaminos.com";
const BRAND = "RealAminos";

// The compliance line every other customer-facing surface (product pages,
// the About page, ad creative, the Google Merchant Center description
// drafted separately) already carries — repeated here per-item since a
// Shopping feed entry has no surrounding page context to inherit it from.
const RUO_DISCLAIMER =
  "For Research Use Only. Not for human or veterinary use. Not a drug, food, dietary supplement, or cosmetic. Not evaluated by the FDA.";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absoluteImageUrl(imageUrl: string): string {
  return imageUrl.startsWith("http") ? imageUrl : `${SITE_URL}${imageUrl}`;
}

export async function GET() {
  const supabase = createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("is_active", true)
    .returns<ProductWithVariants[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (products ?? [])
    .filter((product) => !!product.image_url)
    .flatMap((product) => {
      const description = escapeXml(
        `${product.description ?? `${product.name} — a research compound supplied for laboratory research use.`} ${RUO_DISCLAIMER}`
      );
      const imageLink = absoluteImageUrl(product.image_url!);
      const link = `${SITE_URL}/shop/${product.id}`;

      return product.product_variants
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((variant) => {
          const id = `${product.id}-${variant.size}`.replace(/\s+/g, "");
          const title = escapeXml(`${product.name} (${variant.size})`);
          const availability = variant.stock > 0 ? "in stock" : "out of stock";

          return `
    <item>
      <g:id>${escapeXml(id)}</g:id>
      <title>${title}</title>
      <description>${description}</description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${variant.price.toFixed(2)} USD</g:price>
      <g:brand>${BRAND}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
        });
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>RealAminos Product Feed</title>
    <link>${SITE_URL}</link>
    <description>RealAminos research compound catalog</description>${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
