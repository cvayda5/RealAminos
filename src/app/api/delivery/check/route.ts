import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkLocalDelivery } from "@/lib/shipping/localDelivery";

interface Body {
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// POST /api/delivery/check — tells the cart whether a typed-in address
// qualifies for free local delivery (Arizona, within 50 miles of Surprise,
// AZ). Purely informational: every checkout route runs the same check again
// before an order is saved, so this can't be used to get local delivery for
// an address that doesn't qualify. Signed-in customers only, since it can
// call an external geocoder.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const result = await checkLocalDelivery({
    addressLine1: String(body.addressLine1 ?? "").slice(0, 200),
    city: String(body.city ?? "").slice(0, 100),
    state: String(body.state ?? "").slice(0, 40),
    zip: String(body.zip ?? "").slice(0, 12),
  });

  return NextResponse.json(result);
}
