import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await createClient();

  // Auth check
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await session
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // page_views is RLS-locked to the service role; the admin check above is the
  // only gate on this data.
  const supabase = createServiceClient();

  const range = request.nextUrl.searchParams.get('range') || '7d';
  const daysBack = range === '30d' ? 30 : range === '90d' ? 90 : 7;
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  // Run all queries in parallel
  const [
    { data: audienceRows },
    { data: topPages },
    { data: topTournaments },
    { data: topClubs },
    { data: dailyViews },
    { count: todayViews },
  ] = await Promise.all([
    // Headline counts for the range, split into members vs visitors
    supabase.rpc('audience_summary', { since_date: since }),

    // Top pages overall
    supabase.rpc('top_pages', { since_date: since, lim: 20 }),

    // Top tournament pages
    supabase.rpc('top_tournament_pages', { since_date: since, lim: 20 }),

    // Top club pages
    supabase.rpc('top_club_pages', { since_date: since, lim: 20 }),

    // Daily view counts
    supabase.rpc('daily_view_counts', { since_date: since }),

    // Today's views
    supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  // audience_summary RETURNS TABLE, so PostgREST hands back a one-row array.
  const audience = audienceRows?.[0];

  return NextResponse.json({
    totalViews: Number(audience?.total_views ?? 0),
    todayViews: todayViews ?? 0,
    audience: {
      memberViews: Number(audience?.member_views ?? 0),
      visitorViews: Number(audience?.visitor_views ?? 0),
      // Views recorded before migration 022 — anonymous and member views are
      // indistinguishable in those rows, so they are never counted as either.
      untrackedViews: Number(audience?.untracked_views ?? 0),
      activeUsers: Number(audience?.active_users ?? 0),
      trackingSince: audience?.tracking_since ?? null,
    },
    topPages: topPages ?? [],
    topTournaments: topTournaments ?? [],
    topClubs: topClubs ?? [],
    dailyViews: dailyViews ?? [],
    range,
  });
}
