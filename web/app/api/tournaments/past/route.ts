import { createClient } from '@/lib/supabase/server';
import { todayISO, toISO } from '@/lib/utils';
import { NextResponse } from 'next/server';

const COLUMNS = 'id,name,club_id,date_start,date_end,format,entry_fee,age_class,gender,source,description,raw_data,created_at';
const PAGE_SIZE = 1000;
const PAST_WINDOW_DAYS = 6;

/* Keep only the raw_data fields used for filtering + display */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function slim(t: any) {
  const raw = t.raw_data || {};
  return {
    id: t.id,
    name: t.name,
    club_id: t.club_id,
    date_start: t.date_start,
    date_end: t.date_end,
    format: t.format,
    entry_fee: t.entry_fee,
    age_class: t.age_class,
    gender: t.gender,
    source: t.source,
    description: t.description,
    created_at: t.created_at,
    raw_data: {
      free_slots: raw.free_slots ?? null,
      max_participants: raw.max_participants ?? null,
      hcp_relevant: raw.hcp_relevant ?? false,
      guests_allowed: raw.guests_allowed ?? false,
      prizes: raw.prizes ?? null,
      meldeschluss: raw.meldeschluss ?? null,
      turnierart: raw.turnierart ?? null,
    },
  };
}

export async function GET() {
  const supabase = await createClient();
  const today = todayISO();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PAST_WINDOW_DAYS);
  const cutoffStr = toISO(cutoff);

  const { count } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .lt('date_start', today)
    .gte('date_start', cutoffStr);

  if (!count || count === 0) {
    return NextResponse.json([]);
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);
  const fetches = Array.from({ length: totalPages }, (_, i) => {
    const offset = i * PAGE_SIZE;
    return supabase
      .from('tournaments')
      .select(COLUMNS)
      .lt('date_start', today)
      .gte('date_start', cutoffStr)
      .order('date_start', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
  });

  const results = await Promise.all(fetches);
  const all = results.flatMap(({ data }) => data ?? []).map(slim);

  return NextResponse.json(all, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
