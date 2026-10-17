// SERVER-ONLY. Decides whether an address qualifies for free local delivery:
// Arizona, and within LOCAL_DELIVERY_RADIUS_MILES (straight-line) of Surprise,
// AZ. Used by /api/delivery/check (live feedback in the cart) and re-run by
// every checkout route, so the browser can never just claim "local".
//
// How the distance is found:
//  1. The street address is geocoded with the free US Census geocoder
//     (no API key) and measured exactly. The match is ignored if Census puts
//     it in a different ZIP than the customer typed, or if it disagrees wildly
//     with the ZIP, or if Census is slow/down.
//  2. Otherwise the ZIP code's centre point (table below, every Arizona ZIP
//     within 75 miles of Surprise) is used. A ZIP missing from the table is
//     too far away by definition.
import {
  LOCAL_DELIVERY_ORIGIN_LABEL,
  LOCAL_DELIVERY_RADIUS_MILES,
  isArizona,
} from "./localDeliveryConfig";

// City-centre coordinates for Surprise, AZ.
const ORIGIN = { lat: 33.6292, lng: -112.3679 };

export interface LocalDeliveryCheck {
  eligible: boolean;
  // Rounded to the nearest mile; null when it couldn't be measured.
  miles: number | null;
  // "address" = exact geocode, "zip" = ZIP centre estimate.
  basis: "address" | "zip" | null;
  // Plain-English result, safe to show the customer.
  message: string;
}

export interface LocalDeliveryAddress {
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocodeCensus(addr: LocalDeliveryAddress, zip: string): Promise<{ lat: number; lng: number } | null> {
  const oneLine = `${addr.addressLine1.trim()}, ${addr.city.trim()}, AZ ${zip}`;
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
    encodeURIComponent(oneLine);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const match = json?.result?.addressMatches?.[0];
    return parseCensusMatch(match, zip);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Exported for testing: pulls coordinates out of one Census address match,
// rejecting it if it's malformed or sits in a different ZIP than expected.
export function parseCensusMatch(
  match: { coordinates?: { x?: unknown; y?: unknown }; addressComponents?: { zip?: unknown } } | undefined,
  zip: string
): { lat: number; lng: number } | null {
  const x = match?.coordinates?.x;
  const y = match?.coordinates?.y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  const matchedZip = String(match?.addressComponents?.zip ?? "").slice(0, 5);
  if (matchedZip && matchedZip !== zip) return null;
  return { lat: y, lng: x };
}

export function decideLocalDelivery(miles: number, basis: "address" | "zip"): LocalDeliveryCheck {
  const rounded = Math.round(miles);
  if (miles <= LOCAL_DELIVERY_RADIUS_MILES) {
    return {
      eligible: true,
      miles: rounded,
      basis,
      message: `You're about ${rounded} mile${rounded === 1 ? "" : "s"} from ${LOCAL_DELIVERY_ORIGIN_LABEL} — free local delivery is available.`,
    };
  }
  return {
    eligible: false,
    miles: rounded,
    basis,
    message: `Local delivery covers addresses within ${LOCAL_DELIVERY_RADIUS_MILES} miles of ${LOCAL_DELIVERY_ORIGIN_LABEL}. This address is about ${rounded} miles away.`,
  };
}

export async function checkLocalDelivery(addr: LocalDeliveryAddress): Promise<LocalDeliveryCheck> {
  if (!isArizona(addr.state)) {
    return {
      eligible: false,
      miles: null,
      basis: null,
      message: "Local delivery is only available for Arizona addresses.",
    };
  }

  const zip = (addr.zip ?? "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) {
    return { eligible: false, miles: null, basis: null, message: "Enter a 5-digit ZIP code to check local delivery." };
  }

  const centre = AZ_ZIPS_NEAR_SURPRISE[zip];
  if (!centre) {
    return {
      eligible: false,
      miles: null,
      basis: null,
      message: `That ZIP code is outside our local delivery area (within ${LOCAL_DELIVERY_RADIUS_MILES} miles of ${LOCAL_DELIVERY_ORIGIN_LABEL}).`,
    };
  }
  const zipMiles = haversineMiles(ORIGIN.lat, ORIGIN.lng, centre[0], centre[1]);

  if (addr.addressLine1?.trim() && addr.city?.trim()) {
    const exact = await geocodeCensus(addr, zip);
    if (exact) {
      const exactMiles = haversineMiles(ORIGIN.lat, ORIGIN.lng, exact.lat, exact.lng);
      // A geocode that lands far from its own ZIP is a bad match — don't trust it.
      if (Math.abs(exactMiles - zipMiles) <= 40) return decideLocalDelivery(exactMiles, "address");
    }
  }

  return decideLocalDelivery(zipMiles, "zip");
}

// Arizona ZIP code -> [lat, lng] centre point, for every ZIP within 75 miles
// of Surprise, AZ.
const AZ_ZIPS_NEAR_SURPRISE: Record<string, [number, number]> = {
  "85001": [33.4484, -112.074],
  "85002": [33.4484, -112.074],
  "85003": [33.4511, -112.0774],
  "85004": [33.4557, -112.0686],
  "85005": [33.4484, -112.074],
  "85006": [33.465, -112.0474],
  "85007": [33.4523, -112.0893],
  "85008": [33.4665, -111.9984],
  "85009": [33.4564, -112.1284],
  "85010": [33.4484, -112.074],
  "85011": [33.4484, -112.074],
  "85012": [33.5097, -112.0678],
  "85013": [33.5085, -112.0827],
  "85014": [33.5103, -112.0556],
  "85015": [33.5082, -112.1011],
  "85016": [33.5021, -112.0305],
  "85017": [33.5153, -112.1212],
  "85018": [33.4958, -111.9883],
  "85019": [33.5123, -112.1417],
  "85020": [33.5623, -112.0559],
  "85021": [33.56, -112.0927],
  "85022": [33.6315, -112.052],
  "85023": [33.6324, -112.1118],
  "85024": [33.6617, -112.037],
  "85025": [33.4484, -112.074],
  "85026": [33.4484, -112.074],
  "85027": [33.6819, -112.0996],
  "85028": [33.5851, -112.0087],
  "85029": [33.5961, -112.1199],
  "85030": [33.4484, -112.074],
  "85031": [33.4939, -112.1696],
  "85032": [33.6238, -112.0044],
  "85033": [33.4944, -112.2132],
  "85034": [33.4413, -112.0421],
  "85035": [33.4724, -112.1832],
  "85036": [33.4484, -112.074],
  "85037": [33.4913, -112.2468],
  "85038": [33.4484, -112.074],
  "85039": [33.4484, -112.074],
  "85040": [33.4061, -112.0265],
  "85041": [33.3889, -112.0954],
  "85042": [33.3794, -112.0283],
  "85043": [33.4491, -112.1972],
  "85044": [33.3291, -111.9943],
  "85045": [33.3022, -112.1226],
  "85046": [33.4484, -112.074],
  "85048": [33.316, -112.0669],
  "85050": [33.6863, -111.9963],
  "85051": [33.5591, -112.1332],
  "85053": [33.6299, -112.1316],
  "85054": [33.6731, -111.9461],
  "85055": [33.45, -111.97],
  "85060": [33.4484, -112.074],
  "85061": [33.4484, -112.074],
  "85062": [33.4484, -112.074],
  "85063": [33.4484, -112.074],
  "85064": [33.4484, -112.074],
  "85065": [33.4484, -112.074],
  "85066": [33.4484, -112.074],
  "85067": [33.4484, -112.074],
  "85068": [33.4484, -112.074],
  "85069": [33.4484, -112.074],
  "85070": [33.4484, -112.074],
  "85071": [33.4484, -112.074],
  "85072": [33.4484, -112.074],
  "85073": [33.4484, -112.074],
  "85074": [33.4484, -112.074],
  "85075": [33.4484, -112.074],
  "85076": [33.4484, -112.074],
  "85077": [33.45, -111.97],
  "85078": [33.4484, -112.074],
  "85079": [33.4484, -112.074],
  "85080": [33.4484, -112.074],
  "85082": [33.4484, -112.074],
  "85083": [33.7352, -112.1294],
  "85085": [33.7529, -112.0893],
  "85086": [33.8155, -112.1202],
  "85087": [33.9235, -112.1279],
  "85096": [33.44, -112.09],
  "85097": [33.4484, -112.074],
  "85098": [33.4484, -112.074],
  "85099": [33.45, -111.97],
  "85117": [33.4223, -111.5477],
  "85118": [33.3284, -111.3502],
  "85119": [33.4001, -111.5028],
  "85120": [33.3931, -111.5768],
  "85121": [33.1405, -111.9128],
  "85122": [32.8905, -111.754],
  "85123": [32.7559, -111.671],
  "85127": [33.2097, -111.688],
  "85128": [32.9574, -111.5344],
  "85130": [32.8151, -111.7054],
  "85132": [32.9969, -111.3612],
  "85138": [33.0073, -111.9324],
  "85139": [32.9576, -112.0534],
  "85140": [33.1911, -111.528],
  "85142": [33.2487, -111.6343],
  "85143": [33.1911, -111.528],
  "85144": [33.1911, -111.528],
  "85147": [33.1234, -111.7384],
  "85172": [32.8823, -111.966],
  "85178": [33.4223, -111.5477],
  "85190": [33.5509, -111.3878],
  "85191": [32.9848, -111.447],
  "85193": [32.8554, -111.7973],
  "85194": [32.8984, -111.6261],
  "85201": [33.4317, -111.8469],
  "85202": [33.3851, -111.8724],
  "85203": [33.437, -111.8057],
  "85204": [33.3992, -111.7896],
  "85205": [33.4368, -111.7129],
  "85206": [33.4026, -111.7242],
  "85207": [33.4321, -111.6426],
  "85208": [33.3984, -111.6513],
  "85209": [33.3782, -111.6406],
  "85210": [33.3887, -111.8428],
  "85211": [33.4663, -111.8373],
  "85212": [33.3425, -111.6353],
  "85213": [33.4367, -111.7731],
  "85214": [33.4125, -111.8319],
  "85215": [33.4707, -111.7188],
  "85216": [33.4125, -111.8319],
  "85217": [33.32, -111.32],
  "85218": [33.35, -111.41],
  "85219": [33.4, -111.46],
  "85220": [33.41, -111.57],
  "85221": [33.12, -111.9],
  "85222": [32.87, -111.73],
  "85223": [32.74, -111.68],
  "85224": [33.3301, -111.8632],
  "85225": [33.3105, -111.8239],
  "85226": [33.3092, -111.9198],
  "85227": [33.34, -111.63],
  "85228": [32.96, -111.52],
  "85230": [32.87, -111.75],
  "85233": [33.3354, -111.8153],
  "85234": [33.3527, -111.7809],
  "85236": [33.3024, -111.6969],
  "85238": [33.0, -111.93],
  "85239": [33.02, -112.04],
  "85240": [33.22, -111.53],
  "85242": [33.22, -111.61],
  "85243": [33.15, -111.54],
  "85244": [33.3213, -111.8888],
  "85246": [33.3062, -111.8413],
  "85247": [33.1, -111.75],
  "85248": [33.2509, -111.8593],
  "85249": [33.2414, -111.7745],
  "85250": [33.5218, -111.9049],
  "85251": [33.4936, -111.9167],
  "85252": [33.4995, -111.8684],
  "85253": [33.5494, -111.9565],
  "85254": [33.6165, -111.9554],
  "85255": [33.6968, -111.8892],
  "85256": [33.4858, -111.8533],
  "85257": [33.4669, -111.9151],
  "85258": [33.5647, -111.8931],
  "85259": [33.5879, -111.8404],
  "85260": [33.6013, -111.8867],
  "85261": [33.5092, -111.899],
  "85262": [33.7752, -111.7791],
  "85263": [33.7225, -111.6757],
  "85264": [33.6118, -111.6806],
  "85266": [33.7669, -111.9182],
  "85267": [33.5092, -111.899],
  "85268": [33.6085, -111.7237],
  "85269": [33.6117, -111.7174],
  "85271": [33.5092, -111.899],
  "85272": [32.85, -111.97],
  "85274": [33.4125, -111.8319],
  "85275": [33.4125, -111.8319],
  "85277": [33.4125, -111.8319],
  "85278": [33.41, -111.54],
  "85280": [33.4014, -111.9313],
  "85281": [33.4227, -111.9261],
  "85282": [33.3917, -111.9249],
  "85283": [33.3665, -111.9312],
  "85284": [33.3363, -111.9197],
  "85285": [33.4148, -111.9093],
  "85286": [33.2711, -111.8311],
  "85287": [33.4285, -111.9349],
  "85288": [33.4419, -111.9236],
  "85289": [33.4, -111.96],
  "85290": [33.45, -111.63],
  "85291": [32.99, -111.44],
  "85293": [32.85, -111.79],
  "85294": [32.92, -111.61],
  "85295": [33.3054, -111.7408],
  "85296": [33.3354, -111.7406],
  "85297": [33.2781, -111.7096],
  "85298": [33.2522, -111.7022],
  "85299": [33.3528, -111.789],
  "85301": [33.5311, -112.1767],
  "85302": [33.5675, -112.1753],
  "85303": [33.5262, -112.2149],
  "85304": [33.5943, -112.1746],
  "85305": [33.5291, -112.2482],
  "85306": [33.6239, -112.1776],
  "85307": [33.5376, -112.3137],
  "85308": [33.6539, -112.1694],
  "85309": [33.5352, -112.3804],
  "85310": [33.7047, -112.1641],
  "85311": [33.5387, -112.186],
  "85312": [33.5387, -112.186],
  "85313": [33.6, -112.16],
  "85318": [33.5387, -112.186],
  "85320": [33.9186, -113.2134],
  "85322": [33.3133, -112.7891],
  "85323": [33.4321, -112.3438],
  "85324": [34.0755, -112.134],
  "85326": [33.3703, -112.5838],
  "85327": [33.8333, -111.9508],
  "85329": [33.4353, -112.2979],
  "85331": [33.8851, -111.9349],
  "85332": [34.1764, -112.768],
  "85335": [33.5907, -112.3309],
  "85337": [32.9306, -112.7468],
  "85338": [33.4368, -112.3834],
  "85339": [33.3436, -112.1716],
  "85340": [33.5098, -112.4135],
  "85342": [33.8567, -112.6232],
  "85343": [33.3481, -112.6774],
  "85345": [33.5735, -112.2596],
  "85348": [33.7481, -113.5715],
  "85351": [33.602, -112.2863],
  "85353": [33.4347, -112.2774],
  "85354": [33.4228, -112.9528],
  "85355": [33.5673, -112.4387],
  "85357": [34.0422, -113.458],
  "85358": [33.9686, -112.7296],
  "85361": [33.7637, -112.6142],
  "85362": [34.2508, -112.7567],
  "85363": [33.5908, -112.3013],
  "85372": [33.5975, -112.2718],
  "85373": [33.6588, -112.3214],
  "85374": [33.63, -112.3314],
  "85375": [33.6856, -112.3659],
  "85376": [33.662, -112.3413],
  "85377": [33.824, -111.913],
  "85378": [33.6306, -112.3332],
  "85379": [33.6021, -112.3736],
  "85380": [33.5806, -112.2374],
  "85381": [33.6048, -112.2237],
  "85382": [33.6308, -112.2072],
  "85383": [33.7169, -112.238],
  "85385": [33.5806, -112.2374],
  "85387": [33.7129, -112.4375],
  "85388": [33.6134, -112.4512],
  "85390": [33.8944, -112.8603],
  "85392": [33.4777, -112.3093],
  "85395": [33.479, -112.3947],
  "85396": [33.468, -112.4787],
  "85541": [34.2198, -111.2878],
  "85544": [34.3435, -111.5353],
  "85547": [34.2306, -111.3245],
  "85553": [33.8317, -111.2946],
  "86301": [34.5917, -112.4265],
  "86302": [34.5749, -112.4915],
  "86303": [34.4958, -112.3783],
  "86304": [34.5967, -112.4907],
  "86312": [34.6683, -112.3078],
  "86313": [34.7067, -112.3977],
  "86314": [34.6019, -112.3264],
  "86315": [34.7055, -112.2639],
  "86322": [34.5697, -111.8551],
  "86327": [34.5368, -112.2567],
  "86329": [34.5009, -112.2374],
  "86330": [34.67, -112.52],
  "86332": [34.4541, -112.8966],
  "86333": [34.3655, -112.1296],
  "86338": [34.5053, -112.6855],
  "86343": [34.2241, -112.334]
};
