import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  firstName?: string;
  lastName?: string;
  instagramHandle?: string;
  email?: string;
  preferredCode?: string;
}

const MAX_CODE_LENGTH = 15;

// POST /api/affiliate-signups — public affiliate program application,
// submitted from /affiliates. No login required (this is how someone
// becomes an affiliate in the first place), so everything is validated
// server-side here and written with the service-role client. There's no
// public insert policy on affiliate_signups (see
// 0006_affiliate_signups.sql) — only an admin-all policy — matching the
// same "no direct public writes to sensitive tables" pattern already used
// for discount codes.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const instagramHandle = body.instagramHandle?.trim().replace(/^@+/, "");
  const email = body.email?.trim();
  const preferredCode = body.preferredCode?.trim().toUpperCase();

  if (!firstName || !lastName || !instagramHandle || !email || !preferredCode) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (preferredCode.length > MAX_CODE_LENGTH) {
    return NextResponse.json(
      { error: `Preferred code must be ${MAX_CODE_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("affiliate_signups").insert({
    first_name: firstName,
    last_name: lastName,
    instagram_handle: instagramHandle,
    email,
    preferred_code: preferredCode,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
