import { NextResponse } from "next/server";

// Removed along with Whop card checkout — safe to delete this folder
// (src/app/api/checkout/whop/).
export function GET() {
  return NextResponse.json({ error: "Card checkout has been removed." }, { status: 410 });
}
