import { supabase } from '@/lib/supabase';
import { GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import TurniereClient from './client';

export const revalidate = 3600;

async function getData() {
  const today = todayISO();

  const [tournamentsRes, clubsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*')
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(5000),
    supabase
      .from('golf_clubs')
      .select('id,name,city,region,latitude,longitude'),
  ]);

  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  return {
    tournaments: (tournamentsRes.data ?? []) as Tournament[],
    clubs,
  };
}

export default async function TurnierePage() {
  const { tournaments, clubs } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Turnierkalender</h1>
      <p className="text-gray-500 text-sm mb-6">
        Alle kommenden Golfturniere in Bayern
      </p>
      <TurniereClient tournaments={tournaments} clubs={clubs} />
    </div>
  );
}
