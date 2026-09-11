import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/admin-auth';
import { resolveRange } from '@/lib/analytics-range';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Traffic side of the admin dashboard: how many views, from where, to what.
 * The people side lives in ./users.
 *
 * Ranges arrive as a preset key (`range`) or as `from`/`to` Berlin days, and
 * are resolved server-side so the database and the UI cannot disagree about
 * where a day starts. Every figure is also fetched for the equally long period
 * before it, which is what the trend arrows compare against.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // page_views is RLS-locked to the service role; the admin check above is the
  // only gate on this data.
  const supabase = createServiceClient();

  const params = request.nextUrl.searchParams;
  const range = resolveRange(params.get('range'), params.get('from'), params.get('to'));

  const since = range.since.toISOString();
  const until = range.until.toISOString();
  const rangeArgs = { since_date: since, until_date: until };
  const prevArgs = {
    since_date: range.prevSince.toISOString(),
    until_date: range.prevUntil.toISOString(),
  };

  const [
    { data: audienceRows },
    { data: prevAudienceRows },
    { data: topPages },
    { data: topTournaments },
    { data: topClubs },
    { data: dailyViews },
    { data: sourceRows },
    { data: prevSourceRows },
    { data: trafficSources },
    { data: trafficCampaigns },
    { data: topReferrers },
  ] = await Promise.all([
    supabase.rpc('audience_summary', rangeArgs),
    supabase.rpc('audience_summary', prevArgs),
    supabase.rpc('top_pages', { ...rangeArgs, lim: 25 }),
    supabase.rpc('top_tournament_pages', { ...rangeArgs, lim: 25 }),
    supabase.rpc('top_club_pages', { ...rangeArgs, lim: 25 }),
    supabase.rpc('daily_view_counts', rangeArgs),

    // Traffic attribution (migration 027): totals, the sources themselves, the
    // campaign/placement level below them, and the raw referring hosts.
    supabase.rpc('traffic_source_summary', rangeArgs),
    supabase.rpc('traffic_source_summary', prevArgs),
    supabase.rpc('traffic_sources', { ...rangeArgs, lim: 12 }),
    supabase.rpc('traffic_campaigns', { ...rangeArgs, lim: 20 }),
    supabase.rpc('top_referrers', { ...rangeArgs, lim: 10 }),
  ]);

  // These RPCs RETURN TABLE, so PostgREST hands back a one-row array.
  const audience = audienceRows?.[0];
  const prevAudience = prevAudienceRows?.[0];
  const sourceTotals = sourceRows?.[0];
  const prevSourceTotals = prevSourceRows?.[0];

  return NextResponse.json({
    range: {
      key: range.key,
      from: range.fromDay,
      to: range.toDay,
      days: range.days,
    },
    totalViews: Number(audience?.total_views ?? 0),
    previous: {
      totalViews: Number(prevAudience?.total_views ?? 0),
      memberViews: Number(prevAudience?.member_views ?? 0),
      activeUsers: Number(prevAudience?.active_users ?? 0),
      visits: Number(prevSourceTotals?.visits ?? 0),
    },
    audience: {
      memberViews: Number(audience?.member_views ?? 0),
      visitorViews: Number(audience?.visitor_views ?? 0),
      // Views recorded before migration 022 — anonymous and member views are
      // indistinguishable in those rows, so they are never counted as either.
      untrackedViews: Number(audience?.untracked_views ?? 0),
      activeUsers: Number(audience?.active_users ?? 0),
      trackingSince: audience?.tracking_since ?? null,
    },
    traffic: {
      visits: Number(sourceTotals?.visits ?? 0),
      attributedViews: Number(sourceTotals?.attributed_views ?? 0),
      // Views from before migration 027 — no source was recorded, so they are
      // reported on their own instead of inflating "direct".
      untrackedViews: Number(sourceTotals?.untracked_views ?? 0),
      trackingSince: sourceTotals?.tracking_since ?? null,
      sources: trafficSources ?? [],
      campaigns: trafficCampaigns ?? [],
      referrers: topReferrers ?? [],
    },
    topPages: topPages ?? [],
    topTournaments: topTournaments ?? [],
    topClubs: topClubs ?? [],
    dailyViews: dailyViews ?? [],
  });
}
