import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils';
import { NextResponse } from 'next/server';

const COLUMNS = 'id,name,club_id,date_start,date_end,format,entry_fee,age_class,gender,source,description,raw_data,created_at';
// Supabase PostgREST caps each response at 1000 rows by default.
// Asking for more via .range() silently returns 1000 anyway, which makes
// the `data.length < PAGE_SIZE` break condition fire on the first page
// and truncates the list. Keep this aligned with Supabase's server-side cap.
const PAGE_SIZE = 1000;

/* Keep only the raw_data fields used for filtering + display, drop everything else */
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

  // Fetch all upcoming tournaments sequentially to avoid rate limits
  const all: ReturnType<typeof slim>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('tournaments')
      .select(COLUMNS)
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('[upcoming] fetch error:', error.message);
      break;
    }

    if (!data || data.length === 0) break;

    for (const t of data) {
      all.push(slim(t));
    }

    if (data.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  return NextResponse.json(all, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
