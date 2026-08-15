// Supabase client for use in the BROWSER (Client Components).
// Uses the public anon key, which is safe to expose — Row Level Security
// policies (defined in the SQL migration) are what actually keep data safe,
// not secrecy of this key.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
