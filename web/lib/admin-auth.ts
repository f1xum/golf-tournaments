import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Gate for the admin analytics routes.
 *
 * These routes read page_views and auth.users through the service-role client,
 * which bypasses RLS entirely — this check is the only thing standing between a
 * logged-in golfer and every user's e-mail address. Extracted so the three
 * routes cannot drift apart, and so adding a fourth is not an opportunity to
 * forget it.
 *
 * Returns a NextResponse to hand straight back when the caller is not an admin,
 * or null when they are.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return null;
}
