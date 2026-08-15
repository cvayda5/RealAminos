-- realaminos — staff management + a security fix
-- Run this in the Supabase SQL Editor after 0001 and 0002.

-- ---------------------------------------------------------------
-- Security fix: the original "profiles_update_own" policy let any
-- signed-in user update their OWN profile row with no restriction on
-- which columns changed. Because it only checked "is this my row?"
-- (not "did is_admin stay the same?"), any customer could have opened
-- the browser console and run:
--   supabase.from('profiles').update({ is_admin: true }).eq('id', myId)
-- ...and granted themselves admin. Nothing in the app actually needs
-- customers to edit their own profile row, so the safest fix is to
-- remove that policy entirely rather than try to patch around it.
-- ---------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;

-- ---------------------------------------------------------------
-- Admins need to see the full staff list (email + admin status) to
-- manage who has access — the original schema only let a user see
-- their own profile row. This adds a second SELECT policy; Postgres
-- combines multiple policies for the same action with OR, so this
-- doesn't take away the "see your own row" behavior, it just adds
-- "or see every row, if you're an admin" on top of it.
-- ---------------------------------------------------------------
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- Note: promoting/demoting a staff member's is_admin flag is still
-- NOT allowed directly through the browser client, even for admins —
-- there is deliberately no UPDATE policy for it. That write only
-- happens server-side through /api/admin/staff, using the service
-- role key, after that route has independently verified the caller
-- is an admin. Keeping it out of RLS entirely means there's no policy
-- mistake that could ever let it slip through client-side.
