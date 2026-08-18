# realaminos backend starter

A real, working backend: Postgres (via Supabase) for storage, Supabase Auth
for login + email verification + 2FA, and Next.js route handlers for the
orders API. It's meant to be run locally, read, and extended — not a
finished product. The site prototype (the HTML file) is the storefront
design; this is the plumbing behind "log in," "place an order," and
"see order status."

## Why Supabase

Standard practice for a founder building this themselves is to not hand-roll
password storage, session tokens, or 2FA — that's a lot of security surface
to get right. Supabase gives you a hosted Postgres database plus a
battle-tested auth system (including TOTP 2FA) for free at this scale, and
everything here is plain SQL and REST calls underneath — nothing locks you
into Supabase forever if you outgrow it later.

## What's actually here

```
supabase/migrations/0001_init.sql   the entire database schema — read this first
src/lib/supabase/                   three ways of talking to Supabase (browser / server / admin)
src/app/signup, /login              email+password auth, wired to Supabase Auth
src/app/account/security            2FA (TOTP) enrollment
src/app/account/orders              a customer's own order history + a test-order form
src/app/admin/orders                staff view: every order, editable status + tracking
src/app/api/orders                  POST creates an order, GET lists your own
src/app/api/admin/orders            GET all orders / PATCH status+tracking (admin only)
src/middleware.ts                   keeps login sessions alive across requests
```

The single most important file is the migration — it defines every table
and, just as importantly, the Row Level Security (RLS) policies that decide
who can read or write which rows. Postgres enforces these at the database
level, so even a bug in the Next.js code can't leak one customer's orders to
another or let a non-admin edit order status.

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free account, and
create a new project. This gives you a real hosted Postgres database and an
auth system in about two minutes, no credit card required at this tier.

## 2. Run the migration

In your Supabase project dashboard: **SQL Editor → New Query**, paste in the
entire contents of `supabase/migrations/0001_init.sql`, and run it. This
creates every table, security policy, and the 12 launch products as seed
data.

(If you'd rather use the Supabase CLI and proper migration tooling as this
grows, that's the natural next step — this manual paste is the fastest way
to get moving today.)

## 3. Turn on email confirmation + connect your keys

In your Supabase dashboard: **Project Settings → API**, copy the **Project
URL**, **anon public key**, and **service_role key**.

Copy `.env.example` to `.env.local` in this project and fill in those three
values.

```
cp .env.example .env.local
```

## 4. Install and run

```
npm install
npm run dev
```

Visit `http://localhost:3000`.

## 5. Try the whole flow

1. **Sign Up** with a real email you can check — Supabase sends a confirmation link by default.
2. Click the confirmation link, which logs you in.
3. Go to **Security / 2FA**, scan the QR code with an authenticator app (Google
   Authenticator, Authy, 1Password), and confirm the 6-digit code.
4. Log out and log back in — you'll now be asked for a 2FA code as a second step.
5. Go to **My Orders** and place a test order (there's no payment processor
   wired in yet — see "What's deliberately not here" below).
6. To see the admin side, promote your own account in the Supabase SQL
   Editor:
   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```
7. Refresh **Admin: Orders** — you'll see every order (including other test
   accounts), and can change status or add a tracking number, which
   immediately shows up on that customer's My Orders page.

## What's deliberately not here yet

- **Payment processing.** Placing an order right now just writes rows to the
  database — no money moves. Once you've picked a payment processor (see
  the build plan doc), that integration plugs into `src/app/api/orders/route.ts`
  — you'd charge the card/crypto payment there, and only create the order
  row after the charge succeeds.
- **Connecting this to the actual storefront design.** The HTML prototype
  and this backend aren't wired together yet — the next real step is either
  rebuilding the storefront pages as Next.js pages that call these APIs, or
  keeping the HTML as a static design reference and porting its markup into
  this project's `src/app` pages.
- **RUO waiver enforcement at checkout.** The `orders.waiver_accepted_at`
  column exists and defaults to "now," but nothing yet blocks an order if a
  waiver checkbox wasn't actually checked — that check belongs in the
  checkout UI you build against `/api/orders`.
- **Admin role management UI.** Promoting someone to admin is a manual SQL
  command for now (step 6 above). Fine for a team of one or two; build a
  proper admin-managing-admins screen before you have staff turnover to
  worry about.
- **Deployment.** This runs locally via `npm run dev`. Vercel is the
  natural host for a Next.js app like this (free tier is enough to start)
  and works well alongside Supabase; that's a five-minute step whenever
  you're ready to put this on the internet, not a why-can't-I-do-this-now
  fix.

## A known, low-risk dependency warning

`npm audit` will flag a couple of vulnerabilities in Next.js 14.2.x's
*build-time* tooling (not something exposed to your visitors at runtime).
The fix is upgrading to Next.js 16, which changes several APIs this project
uses (`cookies()` becomes asynchronous, for one) — worth doing deliberately
later rather than as an unplanned breaking change right now. Re-run
`npm audit` periodically and plan that upgrade when you have time to test it.

## If something doesn't work

- **"Not signed in" on pages that should be logged in:** check that
  `src/middleware.ts` is present and `.env.local` has the right project URL —
  a mismatched URL silently fails to read the session cookie.
- **Admin page still says "not an admin" after the SQL update:** log out and
  back in — the admin check happens fresh on each page load, but your
  browser session may be cached.
- **2FA QR code doesn't show:** check the browser console — this usually
  means the Supabase project URL/anon key in `.env.local` are wrong or
  still the placeholder values.
