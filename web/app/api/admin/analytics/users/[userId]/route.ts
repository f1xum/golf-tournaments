import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/admin-auth';
import { resolveRange } from '@/lib/analytics-range';
import { NextRequest, NextResponse } from 'next/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What one person looked at — their most-opened pages inside the selected
 * range, and their last steps through the site regardless of range.
 *
 * Loaded on demand when a row in the user table is expanded, rather than
 * shipped with the directory: it is one round trip per person actually looked
 * at, instead of a payload that grows with every signup.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await params;
  // Reject anything that is not a UUID before it reaches the database — the id
  // comes off the URL, and a malformed one would surface as a Postgres cast
  // error rather than a clean 400.
  if (!UUID.test(userId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const search = request.nextUrl.searchParams;
  const range = resolveRange(search.get('range'), search.get('from'), search.get('to'));

  const [{ data: topPages }, { data: recent }] = await Promise.all([
    supabase.rpc('user_top_pages', {
      target_user: userId,
      since_date: range.since.toISOString(),
      until_date: range.until.toISOString(),
      lim: 15,
    }),
    supabase.rpc('user_recent_views', { target_user: userId, lim: 25 }),
  ]);

  return NextResponse.json({
    topPages: topPages ?? [],
    recentViews: recent ?? [],
  });
}
