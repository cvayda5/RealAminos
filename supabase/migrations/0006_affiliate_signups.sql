-- RealAminos — affiliate program signups
-- Run this in the Supabase SQL Editor after 0001-0005.
--
-- Adds an affiliate_signups table that captures applications submitted from
-- the public /affiliates page, and an /admin/affiliate-signups staff page
-- to review them and mark who's been reached out to.

create table if not exists public.affiliate_signups (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  instagram_handle text not null,
  email text not null,
  -- The discount code name the applicant wants — staff create the actual
  -- discount_codes row by hand (see /admin/discounts) once they've reached
  -- out and confirmed it, so this is just the requested name, not a live
  -- code. Capped at 15 characters to match how it'll read as a real code.
  preferred_code text not null check (char_length(preferred_code) <= 15),
  contacted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.affiliate_signups enable row level security;

-- Staff-only read/manage, same pattern as discount_codes. Deliberately NO
-- public select or insert policy — the public application form on
-- /affiliates goes through /api/affiliate-signups, which uses the
-- service-role client server-side after its own validation, so an
-- unauthenticated visitor can submit an application without being able to
-- read anyone else's.
create policy "affiliate_signups_admin_all" on public.affiliate_signups
  for all using (public.is_admin()) with check (public.is_admin());
