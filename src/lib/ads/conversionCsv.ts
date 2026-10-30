// Builds the CSV Google Ads accepts under Goals > Conversions > Uploads (also
// used by the scheduled daily fetch). One row per PAID order that came from a
// Google Ads click. Shared by the admin download button
// (/api/admin/orders/ad-conversions) and the password-protected feed Google
// fetches on a schedule (/api/ad-conversions/feed).
//
// Safe to re-upload: each row carries the order number as the Order ID, and
// Google ignores a repeat of an Order ID it already has for that conversion.
//
// CONVERSION_NAME must match, letter for letter, the name of the "import"
// conversion action in Google Ads.
export const CONVERSION_NAME = "Purchase Upload";
const TIME_ZONE = "America/Phoenix"; // Arizona — UTC-7 all year, no daylight saving
const UTC_OFFSET_HOURS = -7;

// The orders columns the builder needs.
export const AD_ORDER_COLUMNS =
  "order_number, created_at, status, total, subtotal, shipping_fee, zelle_discount_amount, ad_click_id";

interface AdOrder {
  order_number: string;
  created_at: string;
  total: number | null;
  subtotal: number;
  shipping_fee: number;
  zelle_discount_amount: number | null;
  ad_click_id: string | null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// "2026-10-30T20:05:11Z" → "2026-10-30 13:05:11" in Phoenix time.
function phoenixTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + UTC_OFFSET_HOURS * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildAdConversionsCsv(orders: AdOrder[]): string {
  const lines = [
    `Parameters:TimeZone=${TIME_ZONE}`,
    "Google Click ID,GBRAID,WBRAID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID",
  ];
  for (const o of orders) {
    const raw = String(o.ad_click_id ?? "");
    let gclid = "";
    let gbraid = "";
    let wbraid = "";
    if (raw.startsWith("gbraid:")) gbraid = raw.slice(7);
    else if (raw.startsWith("wbraid:")) wbraid = raw.slice(7);
    else gclid = raw.replace(/^gclid:/, "");
    if (!gclid && !gbraid && !wbraid) continue;

    const value =
      Math.round(((o.total ?? o.subtotal) + o.shipping_fee - (o.zelle_discount_amount ?? 0)) * 100) / 100;
    lines.push(
      [gclid, gbraid, wbraid, CONVERSION_NAME, phoenixTime(o.created_at), value.toFixed(2), "USD", o.order_number]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}
