import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  email?: string;
  // Honeypot: hidden from real visitors, so only bots fill it in.
  website?: string;
}

// POST /api/coming-soon/notify — public "email me when it's live" signup from
// the Coming Soon section on /shop/all. No login needed. Validated here and
// written with the service-role client (the table has no public policies — see
// 0036_coming_soon_signups.sql). A repeat signup is treated as success, and the
// response never reveals whether an address was already on the list.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  // A bot filled the hidden field: pretend it worked, store nothing.
  if (body.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("coming_soon_signups").insert({ email, source: "shop-all" });

  // 23505 = unique violation: this address already signed up.
  if (error && error.code !== "23505") {
    console.error("coming-soon notify: insert failed", error.message);
    return NextResponse.json({ error: "Couldn't save that right now — please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
