'use client';

import { createClient } from '@/lib/supabase/client';

// Module-scope cache so each tracker doesn't re-query on mount. Resolves once
// per page load. Refreshes naturally on full navigation.
let cached: Promise<boolean> | null = null;

function isLocallyOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('thepin_no_track') === '1';
  } catch {
    return false;
  }
}

/**
 * Returns true when this viewer should be tracked by analytics tools.
 * False when they're an admin (e.g. Phillip), or when they've manually
 * opted out via `localStorage.thepin_no_track = "1"`.
 */
export function shouldTrack(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (cached) return cached;
  cached = (async () => {
    if (isLocallyOptedOut()) return false;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return true;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      return data?.role !== 'admin';
    } catch {
      return true; // fail-open: don't lose tracking due to a transient error
    }
  })();
  return cached;
}
