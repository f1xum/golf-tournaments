import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Filter known bots via User-Agent
    const ua = request.headers.get('user-agent') || '';
    if (/bot|crawl|spider|slurp|facebookexternalhit|bingpreview|semrush|ahref|bytespider|gptbot|claudebot/i.test(ua)) {
      return NextResponse.json({ ok: true });
    }

    const { path } = await request.json();
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'missing path' }, { status: 400 });
    }

    // Only track meaningful pages, skip API routes, static assets, and admin
    if (path.startsWith('/api') || path.startsWith('/_next') || path.startsWith('/admin')) {
      return NextResponse.json({ ok: true });
    }

    // page_views is RLS-locked to the service role — the anon key must never
    // be able to write (or read) analytics.
    const supabase = createServiceClient();
    await supabase.from('page_views').insert({ path });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // fail silently — tracking should never break UX
  }
}
