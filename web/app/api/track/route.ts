import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'missing path' }, { status: 400 });
    }

    // Only track meaningful pages, skip API routes and static assets
    if (path.startsWith('/api') || path.startsWith('/_next')) {
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    await supabase.from('page_views').insert({ path });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // fail silently — tracking should never break UX
  }
}
