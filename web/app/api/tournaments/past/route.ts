import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils';
import { NextResponse } from 'next/server';

const COLUMNS = 'id,name,club_id,date_start,date_end,format,rounds,max_handicap,min_handicap,entry_fee,age_class,gender,description,raw_data,source';
const PAGE_SIZE = 1000;

export async function GET() {
  const supabase = await createClient();
  const today = todayISO();

  // Get count first for parallel fetching
  const { count } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .lt('date_start', today);

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
      .order('date_start', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
  });

  const results = await Promise.all(fetches);
  const all = results.flatMap(({ data }) => data ?? []);

  return NextResponse.json(all, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
