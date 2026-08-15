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
supabase/migrations/0002_catalog_details.sql   product descriptions + per-size pricing
supabase/migrations/0003_staff_management.sql  security fix + lets admins see the staff list
supabase/migrations/0004_shipping_info.sql     adds shipping address/contact columns to orders
supabase/migrations/0005_discount_codes.sql    discount_codes table + discount/total columns on orders
src/lib/supabase/                   three ways of talking to Supabase (browser / server / admin)
src/lib/cart/CartContext.tsx        cart state + the slide-out drawer's open/close state
src/lib/email/sendOrderConfirmation.ts   emails the order # confirmation via Resend after checkout
src/components/                     header, footer, entry gate, cart drawer, product card
src/app/page.tsx, /shop, /shop/[id] home, catalog, and product detail pages (real DB data)
src/app/about                       who we are — founders, ownership, story
src/app/lab, /ruo-policy, /legal, /faq   supporting pages ported from the HTML prototype
src/app/signup, /login              email+password auth, wired to Supabase Auth
src/app/forgot-password, /reset-password   email-based password reset
src/app/account/security            2FA (TOTP) enrollment
src/app/account/orders              a customer's own order history + a test-order form
src/app/admin/orders                staff view: every order, editable status + tracking
src/app/admin/discounts             staff view: create/edit/deactivate/delete discount codes
src/app/admin/affiliates            staff view: sales + revenue broken down by discount code
src/app/admin/reports               staff view: revenue sheet filterable by day/week/month/year
src/app/admin/staff                 staff view: promote/demote which accounts are admins
src/app/api/orders                  POST creates an order, GET lists your own
src/app/api/discount-codes/validate POST checks a code at checkout (signed-in customers)
src/app/api/admin/orders            GET all orders / PATCH status+tracking (admin only)
src/app/api/admin/discount-codes    GET/POST/PATCH/DELETE discount codes (admin only)
src/app/api/admin/staff             GET all accounts / PATCH is_admin (admin only)
src/middleware.ts                   keeps login sessions alive across requests
```

This version looks exactly like the original HTML prototype (same header, hero,
product cards, cart drawer, entry gate, footer, and legal/FAQ/lab pages) — but every
page here is wired to the real database instead of hardcoded sample data.

The single most important file is the migration — it defines every table
and, just as importantly, the Row Level Security (RLS) policies that decide
who can read or write which rows. Postgres enforces these at the database
level, so even a bug in the Next.js code can't leak one customer's orders to
another or let a non-admin edit order status.

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free account, and
create a new project. This gives you a real hosted Postgres database and an
auth system in about two minutes, no credit card required at this tier.

## 2. Run the migrations (all five, in order)

In your Supabase project dashboard: **SQL Editor → New Query** (Supabase may
call this "New snippet"), paste in the entire contents of
`supabase/migrations/0001_init.sql`, and run it. This creates every table,
security policy, and the 12 launch products as seed data.

Then repeat with `supabase/migrations/0002_catalog_details.sql` in a second
new query. This adds descriptions and per-size pricing (a new
`product_variants` table) for those same 12 products — it's what the real
Shop page reads from.

Then repeat once more with `supabase/migrations/0003_staff_management.sql`
in a third new query. This closes a security gap in 0001 (see the comments
in that file for exactly what it fixes) and is what lets the new **Manage
Staff** screen work.

Then run `supabase/migrations/0004_shipping_info.sql` in a fourth new query.
This adds the shipping address/contact columns to the `orders` table that
checkout now requires (see "How checkout collects shipping info" below).

Then run `supabase/migrations/0005_discount_codes.sql` in a fifth new
query. This creates the `discount_codes` table behind **Admin: Discount
Codes**, plus the columns on `orders` that record which code (if any) was
used and the final total after the discount (see "How discount codes work"
below). Run these in order — 0001 through 0005 — each one depends on what
the last one created.

If you already ran 0001 through 0004 before this update, you only need to
run 0005 now — it's safe to run on top of what you already have.

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

### Required for the email login code to actually show a code

Every login now emails a one-time code (see "How email login codes actually
work" below), and this needs two things set in your Supabase dashboard
first, or the emails either won't show a code or won't send at all:

1. **Authentication → Email Templates → Magic Link.** By default this
   template only shows a clickable link, not a bare code. Edit it so the
   body includes `{{ .Token }}` somewhere (e.g. "Your code is
   {{ .Token }}") — that's the actual 6-digit code your login screen asks
   for. Without this edit, the email arrives but has nothing for anyone to
   type in.
2. **Project Settings → Auth → SMTP Settings (or search "SMTP" in
   settings).** Supabase's built-in email sender is meant for occasional
   testing only — it's rate-limited to a handful of emails per hour, and
   since this feature emails a code on every single login, you'll hit that
   limit almost immediately with more than one or two people using the
   site. Before relying on this for real, connect a real SMTP provider here
   (Resend, Postmark, and SendGrid all have free tiers that are more than
   enough at this stage).

### Required for order confirmation emails to send

Every order placed now emails the customer a confirmation with their order
number (see "How order confirmation emails work" below). This is sent
directly through Resend's API rather than through Supabase, so it needs its
own key:

1. If you haven't already, log in at [resend.com](https://resend.com) and
   create an API key (**API Keys** in the sidebar) — the same account you
   already set up for the SMTP login codes above works fine, this is just a
   second use of it.
2. Put that key in `.env.local` as `RESEND_API_KEY=re_...`. Without it,
   orders still get created normally — the API route just logs a warning
   and skips sending the email, so this never blocks checkout.

## 4. Install and run

```
npm install
npm run dev
```

Visit `http://localhost:3000`.

## 5. Try the whole flow

1. **Sign Up** with a real email you can check — Supabase sends a confirmation link by default.
   If it doesn't show up, the "check your email" screen has a **Resend Confirmation Email**
   button (a 60-second countdown between clicks stops accidental spam-clicking).
2. Click the confirmation link, which logs you in.
3. Log out, then log back in with your password — you'll now be emailed a 6-digit code and
   asked to enter it before you're let in. This happens on every login for every account (see
   "Required for the email login code to actually show a code" above if no code shows up in
   the email).
4. Try **Forgot password?** on the Log In page: enter your email, click the link Supabase
   sends, and you'll land on a "choose a new password" screen already signed in — same
   resend-with-cooldown pattern as the signup email.
5. Go to **Security / 2FA** and enroll an authenticator app (Google Authenticator, Authy,
   1Password) too, if you want. It's optional and stacks on top of the email code — accounts
   with it enrolled get the authenticator prompt first, then the email code.
6. Go to **Shop** — this now reads real products and prices from your
   database (from the 0002 migration). Pick a size on a product and click
   "Add to Cart" — the cart drawer slides open automatically, same as the
   prototype.
7. Click the cart icon in the header any time to reopen the drawer, then
   click "Continue to Shipping." If you're not logged in it'll send you to
   Login first, then bring you right back. Fill in the shipping form (name,
   phone, email, address, city, state, ZIP — all required) and click "Place
   Order" (there's no payment processor wired in yet — see "What's
   deliberately not here" below, this just records where the order should
   ship).
8. You'll land on **My Orders** and see the order you just placed, including
   the shipping address you entered under "Ship to." There's also a manual
   "place a test order" form on that page (pre-filled with test shipping
   data) if you want to add orders without going through the shop. Check
   the inbox for the email address you entered at checkout — you should
   also have a confirmation email with the order number (see "Required for
   order confirmation emails to send" above if it doesn't show up).
9. To see the admin side for the very first time, promote your own account
    in the Supabase SQL Editor (this one-time step is unavoidable — there's
    no admin yet to click a button for you):
    ```sql
    update public.profiles set is_admin = true where email = 'you@example.com';
    ```
10. Refresh **Admin: Orders** (or click "Staff Admin Login" in the footer) —
    you'll see every order (including the one you placed through the
    Shop/Cart flow), and can change status or add a tracking number, which
    immediately shows up on that customer's My Orders page.
11. Click **Manage Staff** in the top-right of the Orders page. From here on,
    adding more staff doesn't need SQL: have the new person sign up for a
    normal account first (Sign Up page — their own password, their own 2FA),
    then find their email in this list and click "Make Admin." Each staff
    member logs in with their own account, so revoking one person's access
    later never affects anyone else's.
12. Click **Revenue Reports** from either Orders or Manage Staff to see the
    order you placed show up as revenue. Click Day / Week / Month / Year to
    change how it's grouped — the Total row at the bottom always adds up to
    exactly what's in the table above it.
13. Click **Discount Codes**, create one (e.g. `SAVE20` at 20% off), then go
    back to the Shop and add something to your cart. On the cart step,
    enter that code under "Discount code" and click Apply — you'll see the
    discount and new total right there before you even get to shipping.
    Deactivate the code from the Discount Codes page and try applying it
    again to see it correctly get rejected.
14. Click **Affiliate Sales** to see that same order show up under
    `SAVE20` — orders, gross sales, the discount given away, and the actual
    revenue collected, all broken out per code. Click Last 30 Days / This
    Month / This Year / All Time to narrow it to a payout period.

## How the shop/cart actually works

- `src/app/shop` reads products + their sizes/prices straight from Postgres
  (public read — no login needed to browse, same as any real store).
- The cart itself (`src/lib/cart/CartContext.tsx`) lives only in the
  customer's browser, saved to `localStorage` so it survives a page
  refresh. It has nothing to do with the database until checkout.
- The cart is a slide-out drawer (`src/components/CartDrawer.tsx`), not a
  separate page — this matches the prototype's UX. Visiting `/cart`
  directly just opens the drawer and sends you back home.
- The drawer requires the waiver checkbox before "Continue to Shipping" is
  clickable, then requires a real logged-in account (routing through Login
  if needed) before showing the shipping form, and finally calls
  `/api/orders` with both the cart items and the shipping details together
  — that's the same API route from before, now fed real cart data and real
  shipping data instead of the manual test form.
- The **entry gate** (`src/components/SiteGate.tsx`) — the "Restricted
  Research Access" modal you see on first load — is the same
  acknowledge-and-continue check as the prototype. It's a frontend gate
  only; agreeing is remembered for the rest of that browser session (via
  `sessionStorage`) so it doesn't nag on every login/logout, but shows again
  on a genuinely new visit. It is not a substitute for the waiver recorded
  at checkout.
- Editing prices going forward means editing the `product_variants` table
  in Supabase (or building an admin screen for it later) — no code changes
  needed for a price update.

## How email login codes actually work

- Every account, every login, now requires entering a 6-digit code sent to
  that account's email — not just accounts that opted into the
  authenticator-app 2FA on the Security page. That one stays optional and,
  if enrolled, happens first; the emailed code happens after it (or right
  after the password, for accounts without it) either way.
- The code itself is generated and emailed by Supabase's own one-time-code
  system (`supabase.auth.signInWithOtp` / `verifyOtp`) — nothing here
  invents, stores, or checks the code by hand, so it inherits Supabase's own
  expiry and single-use rules rather than us having to build and secure
  that ourselves.
- The Log In page's code screen has the same resend-with-cooldown pattern
  as the signup and password-reset emails (60 seconds between clicks).
- Worth knowing honestly: this is a real requirement in the sense that you
  cannot get through the Log In page's flow without the correct code — but
  it isn't wired into Supabase's official "Assurance Level" system the way
  the authenticator-app 2FA is (Supabase doesn't currently support email as
  an official MFA factor type). In practice that mostly matters for very
  advanced attack scenarios, not for everyday use — but if you want the
  strongest possible guarantee later, the authenticator-app 2FA is the one
  built on Supabase's own enforced assurance levels.

## How password reset actually works

- **Forgot password?** on the Log In page goes to `/forgot-password`, where entering an
  email calls Supabase's `resetPasswordForEmail`. The confirmation message is deliberately
  vague ("if an account exists...") instead of confirming whether that email is registered —
  that's a standard precaution so the form can't be used to check who has an account.
- Clicking the link in that email lands back on `/auth/callback` (the same route the signup
  confirmation link uses), which exchanges the link's one-time code for a real session, then
  sends the browser on to `/reset-password` instead of the normal post-login page.
- `/reset-password` checks that a session actually exists (an expired or already-used link
  won't have one) before showing the "choose a new password" form. Submitting calls
  Supabase's `updateUser`, and since the recovery session is already a real signed-in
  session, they're fully logged in the moment it succeeds — no separate login step after.

## How staff access actually works

- There's no separate "staff login" — every staff member has a completely
  normal account (same Sign Up / Log In / 2FA as any customer). What makes
  someone staff is a single `is_admin` flag on their `profiles` row.
- "Staff Admin Login" in the footer just points at `/admin/orders`. If
  you're not logged in yet, it sends you to Log In and brings you right
  back here afterward. If you're logged in but not an admin, you'll see a
  lock screen explaining that.
- Only an existing admin can grant admin access to someone else, from
  **Manage Staff** (`/admin/staff`) — and that write happens through
  `/api/admin/staff` using the service-role key, never directly from the
  browser. This is deliberate: 0003's migration removed the ability for a
  signed-in user to update their own profile row at all, which closes a
  real hole in 0001 — without that fix, anyone could have opened their
  browser's console and granted themselves admin with one line of
  JavaScript. See the comments in `0003_staff_management.sql` for the
  full explanation.
- An admin can't remove their own access from the Manage Staff screen (the
  button is disabled on your own row) — that's to stop a lone admin from
  ever locking themselves out by accident. If that ever does happen, the
  SQL command in step 8 above still works as a manual override.

## How checkout collects shipping info

- There's no payment processor connected yet (see "What's deliberately not
  here yet" below), but a real order still needs a real place to ship it —
  so checkout now requires full shipping details before it will create an
  order at all.
- In the cart drawer, "Continue to Shipping" (after the waiver checkbox)
  moves to a second screen asking for full name, phone, email, address line
  1, address line 2 (optional), city, state, and ZIP. Email is pre-filled
  from the logged-in account but stays editable. "Place Order" on that
  screen is what actually calls `/api/orders`.
- The manual "place a test order" form on **My Orders** collects the same
  fields, pre-filled with placeholder test data, so it keeps working now
  that the API requires shipping info on every order.
- `src/app/api/orders/route.ts` validates that every required field (all
  except address line 2) is present and non-empty server-side, and returns
  a 400 listing exactly which fields are missing if not — this is enforced
  in the API, not just the form, so it can't be bypassed by calling the
  route directly.
- Shipping details are stored on the order itself (new `shipping_*` columns
  from `0004_shipping_info.sql`) rather than a separate address table —
  simplest thing that works for one-address-per-order. If you later want
  saved/reusable addresses per account, that would be a new table.
- Both **My Orders** (customer view) and **Admin: Orders** (staff view) show
  the shipping address on each order now, so staff have what they need to
  actually pack and ship a package. Orders placed before this migration
  show "no shipping info (pre-migration order)" in the admin table instead
  of blank fields.

## How discount codes work

- **Admin: Discount Codes** (`/admin/discounts`, linked from Orders, Revenue
  Reports, and Manage Staff) is where staff create codes, change what
  percent off they're worth, deactivate them, or delete them entirely.
  Codes are stored uppercase, so `save20` and `SAVE20` are the same code
  both here and at checkout.
- In the cart drawer, there's a "Discount code" field above the waiver
  checkbox. Typing a code and clicking Apply calls
  `/api/discount-codes/validate`, which checks the code against the
  database and returns its percent off if it's real and currently active.
  The cart immediately shows the discount and the new total — before the
  customer even gets to the shipping step.
- **The percent a customer sees at checkout is never trusted when the order
  is actually placed.** `/api/orders/route.ts` looks the code up itself
  server-side and derives the percent from the database again, from
  scratch — the request body's job is just to say *which* code was used,
  never *how much* it's worth. Someone editing the page's JavaScript in
  their browser's devtools to claim a bigger discount would have no effect;
  the server simply ignores whatever percent (if any) the client sent.
- If a code gets deactivated or deleted in the moment between a customer
  applying it and clicking Place Order, the order is rejected with "That
  discount code is no longer valid" rather than silently charging full
  price or silently honoring a dead code — the customer finds out
  immediately and can retry.
- Both the discount-lookup route and the order route use the service-role
  client to read `discount_codes`, the same way the admin routes do. That's
  deliberate: there's no RLS policy letting regular customers read this
  table directly (see the comment in `0005_discount_codes.sql`) — if there
  were, any signed-in customer could list every code that exists, active or
  not, just by querying the table from the browser console. Routing the
  lookup through a server-side route that only ever returns "valid or not"
  for the one code asked about avoids that.
- Orders store `subtotal` (sum of line items, unchanged meaning), plus new
  `discount_code`, `discount_percent`, and `total` columns (the last is
  what the customer actually owes after the discount). Both **My Orders**
  and **Admin: Orders** show the discount and total on any order that used
  one. Deactivating or deleting a code afterward never changes what's
  already stored on past orders — only whether it can be applied to *new*
  ones.
- The order confirmation email includes the discount line and the
  discounted total when a code was used, so what the customer sees in
  their inbox always matches what's shown in My Orders.
- **Revenue Reports** now sums each order's `total` (after discount)
  instead of `subtotal`, since that's the number that actually reflects
  what was charged. Orders placed before this migration have no discount,
  so their `total` was backfilled to equal their `subtotal` — nothing
  changes for them.

## How affiliate sales tracking works

- **Admin: Affiliate Sales** (`/admin/affiliates`, linked from Orders,
  Discount Codes, Revenue Reports, and Manage Staff) exists specifically
  for paying affiliates: it breaks out orders and revenue by which discount
  code was used, so you can see exactly what each affiliate's code sold.
- Every discount code that exists shows up here, even ones with zero
  orders yet — an affiliate whose code hasn't sold anything is useful to
  know about too, not just the ones that are performing.
- Each row shows: number of orders, **gross sales** (the subtotal before
  the discount — what the products would have cost at full price),
  **discount given** (what the customer didn't pay — this is the cost of
  running that code), and **revenue collected** (gross sales minus the
  discount — what you actually got paid). Rows are sorted by revenue
  collected, highest first, so your best-performing affiliates are at the
  top.
- Filter by Last 30 Days / This Month / This Year / All Time to match
  however often you actually pay affiliates out (e.g. run it monthly right
  before a payout).
- This page deliberately does NOT calculate a payout amount or commission
  — there's no commission-rate field anywhere in this app, because that's
  a business term you'd negotiate per affiliate, not something to guess at
  in code. This page gives you the real sales numbers; you apply whatever
  percentage or flat rate you've agreed with each affiliate on top of it.
- Uses the same data as Revenue Reports and Discount Codes (the `orders`
  and `discount_codes` tables) — there's no separate "affiliates" table.
  A discount code IS the affiliate's identity here; if you want richer
  affiliate profiles later (contact info, custom commission rate stored
  per code, automatic payout calculations), that would be a natural
  `affiliates` table referencing `discount_codes`.

## How order confirmation emails work

- Every order — whether placed through the real cart or the manual "place a
  test order" form — sends the shipping email address a confirmation with
  the order number, items, total, and shipping address, right after the
  order is written to the database.
- This is sent by `src/lib/email/sendOrderConfirmation.ts` calling Resend's
  HTTP API directly (`api.resend.com/emails`), not through Supabase Auth's
  email system — Supabase's emails are only for login/signup/password-reset,
  they can't be used to send an arbitrary "here's your order" email. It
  reuses the same Resend account already set up for the SMTP login codes,
  just a different API key (see "Required for order confirmation emails to
  send" above), and sends from `onboarding@resend.dev` — Resend's built-in
  test sender, so no domain verification is needed to get this working
  today.
- If `RESEND_API_KEY` isn't set, or Resend's API call fails for any reason,
  the order still gets created normally — the failure is only logged to the
  server console (`console.error`/`console.warn`), never returned as an
  error to the customer. An order that succeeded shouldn't look like it
  failed just because an email didn't send.
- Once you're ready to send from your own domain instead of
  `onboarding@resend.dev` (e.g. `orders@realaminos.com`), verify that domain
  in Resend's dashboard and swap the `from` address in
  `sendOrderConfirmation.ts` — no other code changes needed.
- **Gotcha to know about:** Resend rejects sends to obviously fake/reserved
  addresses like anything `@example.com` with a 422 error (`Invalid 'to'
  field`), even though real addresses work fine. That's why the "place a
  test order" form pre-fills the Email field with your actual logged-in
  account email instead of a placeholder — if you overwrite it with
  something made-up while testing, the order will still be created, but the
  confirmation email will silently fail (logged server-side, not shown to
  the customer, per the point above).

## How the revenue reports work

- **Admin: Reports** (`/admin/reports`, linked from Orders and Manage Staff)
  is a "sheet" of revenue grouped by whichever button you click — Day,
  Week, Month, or Year — with a Total row at the bottom that always matches
  exactly what's shown above it.
- "Revenue" here means the sum of `orders.subtotal` — there's no payment
  processor connected yet (see below), so this is orders placed, not money
  actually collected. Once a processor is wired in, this is the natural
  place to switch the sum to actual captured payments instead.
- Each view caps how far back it shows to keep the sheet readable: last 30
  days, last 12 weeks, last 12 months, or last 6 years. The "All-time
  revenue" figure above the table always reflects every order regardless of
  that cap, so it never looks like revenue disappeared just because a row
  scrolled out of the visible range.
- The grouping itself happens in the page's server code (plain JavaScript
  date math over the orders Supabase returns), not a SQL aggregate — that's
  the simplest thing that works at today's order volume. If this ever gets
  slow as order counts grow, the natural upgrade is a Postgres view or RPC
  function that does the `date_trunc` + `sum` server-side instead.
- Same access rule as every other admin page: it's gated on the signed-in
  account's `is_admin` flag, and it reads orders through the same
  `orders_select_own_or_admin` RLS policy the Orders page already relies
  on — no new database permissions were needed for this feature.

## About page

- `src/app/about/page.tsx` — the founder/company story (father-and-son,
  firefighter-owned, Surprise, Arizona), linked from the header nav
  ("About") and the footer's "Company" column. It's plain hardcoded JSX,
  same as the Lab Testing and RUO Policy pages, so editing the actual words
  is just editing text in that file — no database or CMS involved.
- The footer's short description line and city ("Surprise, Arizona") were
  updated to match. If any of these details change, update both
  `src/app/about/page.tsx` and `src/components/SiteFooter.tsx`.

## What's deliberately not here yet

- **Payment processing.** Placing an order right now just writes rows to the
  database — no money moves. Once you've picked a payment processor (see
  the build plan doc), that integration plugs into `src/app/api/orders/route.ts`
  — you'd charge the card/crypto payment there, and only create the order
  row after the charge succeeds.
- **Stronger RUO waiver enforcement.** The checkout UI won't let you submit
  without checking the box, but that's a frontend check only — the
  `orders.waiver_accepted_at` column just defaults to "now" in the
  database. Worth having the API route itself refuse to create an order
  without an explicit waiver flag in the request, so the rule is enforced
  server-side too, not just in the UI.
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
- **Password reset (or signup confirmation) link shows a Supabase error page
  like "requested path is invalid":** in your Supabase dashboard, go to
  **Authentication → URL Configuration** and make sure `http://localhost:3000/**`
  is listed under Redirect URLs. New projects usually have this by default,
  but it's worth checking if either email link errors instead of landing
  back on your site.
