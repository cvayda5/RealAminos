// Thin wrapper around Shippo's REST API — deliberately plain `fetch`, no SDK
// dependency, matching how src/lib/whop/client.ts and src/lib/email/* talk to
// their own APIs. Two calls only: quote rates for a shipment, then buy one.
//
// SHIPPO_API_KEY is a server-only secret. Get a free account at
// goshippo.com, then Settings > API. Use a "shippo_test_..." key first —
// test-key shipments return fake rates and "buying" a label with one costs
// nothing and prints a clearly-marked test PDF, which is how to prove out
// this whole flow before pointing it at a real "shippo_live_..." key. See
// .env.example for the SHIP_FROM_* vars this also depends on.
const SHIPPO_API_BASE = "https://api.goshippo.com";

// Fixed box dimensions for every label this generates. Peptide orders are
// small and fairly uniform (vials + cold-pack in a padded box) — rather than
// make staff type three dimensions on every single order, only weight (the
// one dimension that actually varies much order to order) is asked for, and
// these stay hard-coded. Bump them here if the real box size changes.
const PARCEL_LENGTH_IN = 6;
const PARCEL_WIDTH_IN = 4;
const PARCEL_HEIGHT_IN = 3;

export interface ShipToAddress {
  name: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  phone?: string | null;
  email?: string | null;
}

export interface ShippingRate {
  objectId: string;
  amount: string; // Shippo returns this as a string, e.g. "8.45"
  currency: string;
  provider: string; // e.g. "USPS"
  serviceLevelName: string; // e.g. "Priority Mail"
  estimatedDays: number | null;
}

function getShipFromAddress() {
  const required = [
    "SHIP_FROM_NAME",
    "SHIP_FROM_STREET1",
    "SHIP_FROM_CITY",
    "SHIP_FROM_STATE",
    "SHIP_FROM_ZIP",
    "SHIP_FROM_PHONE",
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${key} is not set — see .env.example's SHIP_FROM_* vars.`);
    }
  }

  return {
    name: process.env.SHIP_FROM_NAME!,
    street1: process.env.SHIP_FROM_STREET1!,
    street2: process.env.SHIP_FROM_STREET2 || undefined,
    city: process.env.SHIP_FROM_CITY!,
    state: process.env.SHIP_FROM_STATE!,
    zip: process.env.SHIP_FROM_ZIP!,
    country: "US",
    phone: process.env.SHIP_FROM_PHONE!,
    email: process.env.SHIP_FROM_EMAIL || undefined,
  };
}

function authHeaders() {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey) {
    throw new Error("SHIPPO_API_KEY is not set — see .env.example.");
  }
  return {
    Authorization: `ShippoToken ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// Creates a Shippo "shipment" (a from/to/parcel triple) and returns the
// rates quoted against it. `async: false` makes Shippo wait and return
// rates directly in this same response instead of requiring a webhook or
// poll — simpler for an admin button that just wants a list right away.
export async function getShippingRates(
  toAddress: ShipToAddress,
  weightOz: number
): Promise<ShippingRate[]> {
  const res = await fetch(`${SHIPPO_API_BASE}/shipments/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      address_from: getShipFromAddress(),
      address_to: {
        name: toAddress.name,
        street1: toAddress.street1,
        street2: toAddress.street2 || undefined,
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.zip,
        country: "US",
        phone: toAddress.phone || undefined,
        email: toAddress.email || undefined,
      },
      parcels: [
        {
          length: String(PARCEL_LENGTH_IN),
          width: String(PARCEL_WIDTH_IN),
          height: String(PARCEL_HEIGHT_IN),
          distance_unit: "in",
          weight: String(weightOz),
          mass_unit: "oz",
        },
      ],
      async: false,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.detail || `Shippo shipment request failed (${res.status}).`);
  }

  const rates = (body.rates ?? []) as Array<Record<string, unknown>>;

  return rates
    .map((r) => ({
      objectId: r.object_id as string,
      amount: r.amount as string,
      currency: r.currency as string,
      provider: r.provider as string,
      serviceLevelName: (r.servicelevel as { name?: string } | undefined)?.name ?? "Unknown service",
      estimatedDays: (r.estimated_days as number | null) ?? null,
    }))
    .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
}

export interface PurchasedLabel {
  trackingNumber: string;
  labelUrl: string;
}

// Buys the label for a specific rate returned by getShippingRates. `async:
// false` again means this waits for the real result (SUCCESS/ERROR) instead
// of needing a webhook.
//
// Note: the transaction response's own `rate` field is just the rate's
// object_id, not the expanded provider/service-level info — so this doesn't
// try to read carrier/service back out of it. The caller already knows
// which ShippingRate (provider, serviceLevelName) it asked to buy, since it
// had to have it in hand to get this objectId in the first place.
export async function purchaseLabel(rateObjectId: string): Promise<PurchasedLabel> {
  const res = await fetch(`${SHIPPO_API_BASE}/transactions/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      rate: rateObjectId,
      // "PDF" (Shippo's bare default) renders the label centered on a
      // full US-Letter page — fine for a laser/inkjet printer, wrong for a
      // 4x6 thermal label printer. PDF_4x6 sizes the PDF itself to a 4x6
      // page, which is what a thermal printer expects. This is set per
      // API call, so a label-size preference changed on Shippo's own
      // dashboard has no effect here — this is the only place that
      // matters for labels bought through the site.
      label_file_type: "PDF_4x6",
      async: false,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.status !== "SUCCESS") {
    const messages = Array.isArray(body.messages)
      ? body.messages.map((m: { text?: string }) => m.text).join(" ")
      : null;
    throw new Error(messages || body?.detail || "Shippo couldn't complete this label purchase.");
  }

  return {
    trackingNumber: body.tracking_number,
    labelUrl: body.label_url,
  };
}
