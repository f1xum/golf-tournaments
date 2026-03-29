import { Suspense } from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import TurniereClient from './client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Turnierkalender – Alle Golfturniere in Deutschland',
  description: 'Alle aktuellen Golfturniere in Deutschland auf einen Blick. Filtere nach Bundesland, Spielform, Nenngeld und mehr. Kostenlos auf The Pin.',
  alternates: { canonical: 'https://thepin.app/turniere' },
};

async function fetchAllPages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  columns: string,
  dateFilter: 'gte' | 'lt',
  today: string,
  ascending: boolean,
) {
  const pageSize = 1000;

  // First, get total count so we can fetch pages in parallel
  let countQuery = supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true });
  if (dateFilter === 'gte') {
    countQuery = countQuery.gte('date_start', today);
  } else {
    countQuery = countQuery.lt('date_start', today);
  }
  const { count } = await countQuery;
  if (!count || count === 0) return [];

  // Fetch all pages in parallel
  const totalPages = Math.ceil(count / pageSize);
  const fetches = Array.from({ length: totalPages }, (_, i) => {
    const offset = i * pageSize;
    let query = supabase.from('tournaments').select(columns);
    if (dateFilter === 'gte') {
      query = query.gte('date_start', today);
    } else {
      query = query.lt('date_start', today);
    }
    return query
      .order('date_start', { ascending })
      .range(offset, offset + pageSize - 1);
  });

  const results = await Promise.all(fetches);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  for (const { data } of results) {
    if (data) all.push(...data);
  }
  return all;
}

async function getData() {
  const supabase = await createClient();
  const today = todayISO();

  const tournamentColumns = 'id,name,club_id,date_start,date_end,format,rounds,max_handicap,min_handicap,entry_fee,age_class,gender,description,raw_data,source';

  // Only fetch upcoming server-side; past tournaments are lazy-loaded client-side
  const [upcoming, clubsRes, userRes] = await Promise.all([
    fetchAllPages(supabase, tournamentColumns, 'gte', today, true),
    supabase
      .from('golf_clubs')
      .select('id,name,city,region,latitude,longitude'),
    supabase.auth.getUser(),
  ]);

  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  // Get home club coordinates + saved clubs if logged in
  let homeClubCoords: [number, number] | null = null;
  let savedClubIds: string[] = [];
  const user = userRes.data?.user;
  if (user) {
    const [{ data: profile }, { data: savedClubs }] = await Promise.all([
      supabase
        .from('profiles')
        .select('home_club_id')
        .eq('id', user.id)
        .single(),
      supabase
        .from('saved_clubs')
        .select('club_id')
        .eq('user_id', user.id),
    ]);
    if (profile?.home_club_id) {
      const hc = clubs[profile.home_club_id];
      if (hc?.latitude && hc?.longitude) {
        homeClubCoords = [hc.latitude, hc.longitude];
      }
    }
    savedClubIds = (savedClubs ?? []).map((r) => r.club_id);
  }

  return {
    upcoming: upcoming as Tournament[],
    clubs,
    homeClubCoords,
    savedClubIds,
    isLoggedIn: !!user,
  };
}

export default async function TurnierePage() {
  const { upcoming, clubs, homeClubCoords, savedClubIds, isLoggedIn } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Turnierkalender</h1>
      <p className="text-gray-500 text-sm mb-6">
        Alle Golfturniere in Deutschland
      </p>
      <Suspense>
        <TurniereClient upcoming={upcoming} clubs={clubs} homeClubCoords={homeClubCoords} savedClubIds={savedClubIds} isLoggedIn={isLoggedIn} />
      </Suspense>
    </div>
  );
}
