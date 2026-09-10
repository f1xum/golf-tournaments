import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Source labels arrive from the client, where they were read off the URL — so a
 * visitor can put anything in utm_source. Lower-cased, reduced to a plain
 * label charset and capped, which keeps junk and unbounded cardinality out of
 * the analytics tables.
 */
function label(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+\- ]/g, '')
    .trim()
    .slice(0, max);
  return cleaned.length > 0 ? cleaned : null;
}

function host(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 120);
  return cleaned.length > 0 ? cleaned : null;
}

export async function POST(request: NextRequest) {
  try {
    // Filter known bots via User-Agent
    const ua = request.headers.get('user-agent') || '';
    if (/bot|crawl|spider|slurp|facebookexternalhit|bingpreview|semrush|ahref|bytespider|gptbot|claudebot/i.test(ua)) {
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    const { path } = body;
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'missing path' }, { status: 400 });
    }

    // Only track meaningful pages, skip API routes, static assets, and admin
    if (path.startsWith('/api') || path.startsWith('/_next') || path.startsWith('/admin')) {
      return NextResponse.json({ ok: true });
    }

    // Who is viewing? The beacon is same-origin, so the Supabase session
    // cookie rides along and we can separate members from anonymous visitors.
    // A hiccup in the auth lookup must not cost us the page view, so we fall
    // back to NULL — the view is then counted as an anonymous one.
    let userId: string | null = null;
    try {
      const session = await createClient();
      const { data: { user } } = await session.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // leave userId null
    }

    // Where did they come from (migration 027)? Worked out client-side in
    // lib/traffic-source.ts. A client on a stale bundle sends nothing, and
    // those rows stay NULL — reported as unattributed rather than as 'direct'.
    const source = label(body.source, 48);

    // page_views is RLS-locked to the service role — the anon key must never
    // be able to write (or read) analytics.
    const supabase = createServiceClient();
    await supabase.from('page_views').insert({
      path,
      user_id: userId,
      source,
      medium: source ? label(body.medium, 48) : null,
      campaign: source ? label(body.campaign, 64) : null,
      referrer_host: host(body.referrerHost),
      is_entry: body.isEntry === true,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // fail silently — tracking should never break UX
  }
}
