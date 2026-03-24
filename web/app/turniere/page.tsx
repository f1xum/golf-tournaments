import { createClient } from '@/lib/supabase/server';
import { GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import TurniereClient from './client';

export const revalidate = 3600;

async function getData() {
  const supabase = await createClient();
  const today = todayISO();

  const [upcomingRes, pastRes, clubsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*')
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(5000),
    supabase
      .from('tournaments')
      .select('*')
      .lt('date_start', today)
      .order('date_start', { ascending: false })
      .limit(500),
    supabase
      .from('golf_clubs')
      .select('id,name,city,region,latitude,longitude'),
  ]);

  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  return {
    upcoming: (upcomingRes.data ?? []) as Tournament[],
    past: (pastRes.data ?? []) as Tournament[],
    clubs,
  };
}

export default async function TurnierePage() {
  const { upcoming, past, clubs } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Turnierkalender</h1>
      <p className="text-gray-500 text-sm mb-6">
        Alle kommenden Golfturniere in Bayern
      </p>
      <TurniereClient upcoming={upcoming} past={past} clubs={clubs} />
    </div>
  );
}
