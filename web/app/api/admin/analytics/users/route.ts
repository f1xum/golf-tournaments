import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/admin-auth';
import { resolveRange } from '@/lib/analytics-range';
import { NextRequest, NextResponse } from 'next/server';

/**
 * The people side of the dashboard: who signed up, who came back, who stopped.
 *
 * Every function called here is SECURITY DEFINER (migration 028) because it
 * reads auth.users, and every one of them is revoked from anon/authenticated —
 * only the service-role key can call them, and only after requireAdmin.
 *
 * The directory includes accounts with zero activity on purpose. "Who has not
 * come back" is the more useful half of a retention question, and hiding
 * dormant accounts would make the list flatter over time, which reads as
 * growth.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = createServiceClient();

  const params = request.nextUrl.searchParams;
  const range = resolveRange(params.get('range'), params.get('from'), params.get('to'));

  const rangeArgs = {
    since_date: range.since.toISOString(),
    until_date: range.until.toISOString(),
  };
  const prevArgs = {
    since_date: range.prevSince.toISOString(),
    until_date: range.prevUntil.toISOString(),
  };

  const [
    { data: summaryRows, error: summaryError },
    { data: prevSummaryRows },
    { data: daily },
    { data: directory },
    { data: cohorts },
  ] = await Promise.all([
    supabase.rpc('user_analytics_summary', rangeArgs),
    supabase.rpc('user_analytics_summary', prevArgs),
    supabase.rpc('user_activity_daily', rangeArgs),
    supabase.rpc('user_directory', { ...rangeArgs, lim: 500 }),
    supabase.rpc('user_retention_cohorts', { weeks_back: 12 }),
  ]);

  // A missing function means migration 028 has not been applied yet. Saying so
  // beats rendering a dashboard full of confident zeroes.
  if (summaryError) {
    return NextResponse.json(
      { error: 'rpc_failed', detail: summaryError.message },
      { status: 500 }
    );
  }

  const summary = summaryRows?.[0];
  const prev = prevSummaryRows?.[0];

  const num = (value: unknown) => Number(value ?? 0);

  return NextResponse.json({
    range: {
      key: range.key,
      from: range.fromDay,
      to: range.toDay,
      days: range.days,
    },
    summary: {
      totalUsers: num(summary?.total_users),
      newUsers: num(summary?.new_users),
      activeUsers: num(summary?.active_users),
      newActiveUsers: num(summary?.new_active_users),
      returningUsers: num(summary?.returning_users),
      repeatUsers: num(summary?.repeat_users),
      dormantUsers: num(summary?.dormant_users),
      visits: num(summary?.visits),
      memberViews: num(summary?.member_views),
      activeDays: num(summary?.active_days),
      trackingSince: summary?.tracking_since ?? null,
    },
    previous: {
      totalUsers: num(prev?.total_users),
      newUsers: num(prev?.new_users),
      activeUsers: num(prev?.active_users),
      returningUsers: num(prev?.returning_users),
      repeatUsers: num(prev?.repeat_users),
      dormantUsers: num(prev?.dormant_users),
      visits: num(prev?.visits),
      memberViews: num(prev?.member_views),
    },
    daily: daily ?? [],
    users: directory ?? [],
    cohorts: cohorts ?? [],
  });
}
