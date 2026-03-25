import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import TurniereClient from './client';

export const revalidate = 3600;

async function getData() {
  const supabase = await createClient();
  const today = todayISO();

  // Select only the columns needed for filtering + display (skip source_url, registration_url etc.)
  const tournamentColumns = 'id,name,club_id,date_start,date_end,format,rounds,max_handicap,min_handicap,entry_fee,age_class,gender,description,raw_data';

  const [upcomingRes, pastRes, clubsRes, userRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select(tournamentColumns)
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(5000),
    supabase
      .from('tournaments')
      .select(tournamentColumns)
      .lt('date_start', today)
      .order('date_start', { ascending: false })
      .limit(200),
    supabase
      .from('golf_clubs')
      .select('id,name,city,region,latitude,longitude'),
    supabase.auth.getUser(),
  ]);

  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  // Get home club coordinates if logged in
  let homeClubCoords: [number, number] | null = null;
  const user = userRes.data?.user;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('home_club_id')
      .eq('id', user.id)
      .single();
    if (profile?.home_club_id) {
      const hc = clubs[profile.home_club_id];
      if (hc?.latitude && hc?.longitude) {
        homeClubCoords = [hc.latitude, hc.longitude];
      }
    }
  }

  return {
    upcoming: (upcomingRes.data ?? []) as Tournament[],
    past: (pastRes.data ?? []) as Tournament[],
    clubs,
    homeClubCoords,
  };
}

export default async function TurnierePage() {
  const { upcoming, past, clubs, homeClubCoords } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Turnierkalender</h1>
      <p className="text-gray-500 text-sm mb-6">
        Alle kommenden Golfturniere in Bayern
      </p>
      <Suspense>
        <TurniereClient upcoming={upcoming} past={past} clubs={clubs} homeClubCoords={homeClubCoords} />
      </Suspense>
    </div>
  );
}
