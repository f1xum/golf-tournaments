import { createPublicClient } from '@/lib/supabase/public';
import { GolfClub } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import MapWrapper from './client';

export const revalidate = 3600;

async function getData() {
  const supabase = createPublicClient();
  const today = todayISO();

  const [clubsRes, countsRes] = await Promise.all([
    supabase
      .from('golf_clubs')
      .select('id,name,city,region,latitude,longitude,website,merged_into')
      .not('latitude', 'is', null)
      // Duplicates sit on top of their keeper's pin and show zero tournaments.
      .is('merged_into', null),
    supabase
      .from('tournaments')
      .select('club_id')
      .gte('date_start', today)
      .not('club_id', 'is', null),
  ]);

  const clubs = (clubsRes.data ?? []) as GolfClub[];

  const tournamentCounts: Record<string, number> = {};
  (countsRes.data ?? []).forEach((t: { club_id: string }) => {
    tournamentCounts[t.club_id] = (tournamentCounts[t.club_id] || 0) + 1;
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
      <div className="h-[calc(100vh-260px)] sm:h-[calc(100vh-200px)] min-h-[300px] max-h-[600px] sm:max-h-none rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <MapWrapper clubs={clubs} tournamentCounts={tournamentCounts} />
      </div>
    </div>
  );
}
