import { NextResponse } from "next/server";

// Removed along with Whop card checkout — safe to delete this folder
// (src/app/api/webhooks/whop/).
export function POST() {
  return NextResponse.json({ error: "This webhook has been removed." }, { status: 410 });
}
