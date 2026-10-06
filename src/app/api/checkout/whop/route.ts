import { NextResponse } from "next/server";

// Card checkout (Whop) was removed after that account was banned. This file
// is only a stub because the repo can't be edited by deleting files here —
// it is safe to delete this whole folder (src/app/api/checkout/whop/).
export function POST() {
  return NextResponse.json(
    { error: "Card payments are no longer available. Please pay by Zelle." },
    { status: 410 }
  );
}
