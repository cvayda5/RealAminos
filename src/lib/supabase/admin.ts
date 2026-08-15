// SERVER-ONLY client that uses the service role key, which bypasses Row
// Level Security entirely. Only ever import this from server-side code that
// has already verified the caller is an admin — never from a Client
// Component, and never send this key to the browser.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
