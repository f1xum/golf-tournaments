import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cookie-free Supabase client for public, cacheable reads.
 *
 * `lib/supabase/server.ts` calls `cookies()`, and touching a Dynamic API during
 * render opts the route out of static rendering — which silently disabled every
 * `export const revalidate` on the public pages and turned each page view into a
 * function invocation. Public data is identical for every visitor, so it does
 * not need the session; anything user-specific is loaded in the browser via
 * `useViewer`.
 *
 * Reads go through the anon key and are therefore subject to the same RLS
 * policies an anonymous visitor already hits.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
