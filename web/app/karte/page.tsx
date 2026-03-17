import { supabase } from '@/lib/supabase';
import { GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import MapWrapper from './client';

export const revalidate = 3600;

async function getData() {
  const today = todayISO();

  const [clubsRes, tournamentsRes] = await Promise.all([
    supabase
      .from('golf_clubs')
      .select('id,name,city,region,latitude,longitude,website')
      .not('latitude', 'is', null),
    supabase
      .from('tournaments')
      .select('id,name,date_start,club_id')
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(5000),
  ]);

  const clubs = (clubsRes.data ?? []) as GolfClub[];
  const tournaments = (tournamentsRes.data ?? []) as Tournament[];

  // Count upcoming tournaments per club
  const tournamentCounts: Record<string, number> = {};
  tournaments.forEach((t) => {
    if (t.club_id) {
      tournamentCounts[t.club_id] = (tournamentCounts[t.club_id] || 0) + 1;
    }
  });

  return { clubs, tournamentCounts };
}

export default async function KartePage() {
  const { clubs, tournamentCounts } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Karte</h1>
      <p className="text-gray-500 text-sm mb-4">
        {clubs.length} Clubs mit Standort
      </p>
      <div className="h-[calc(100vh-200px)] min-h-[400px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <MapWrapper clubs={clubs} tournamentCounts={tournamentCounts} />
      </div>
    </div>
  );
}
