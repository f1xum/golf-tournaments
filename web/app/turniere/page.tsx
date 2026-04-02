import { Suspense } from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { GolfClub } from '@/lib/types';
import TurniereClient from './client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Turnierkalender – Alle Golfturniere in Deutschland',
  description: 'Alle aktuellen Golfturniere in Deutschland auf einen Blick. Filtere nach Bundesland, Spielform, Nenngeld und mehr. Kostenlos auf The Pin.',
  alternates: { canonical: 'https://thepin.app/turniere' },
};

async function getData() {
  const supabase = await createClient();

  const [clubsRes, userRes] = await Promise.all([
    supabase
      .from('golf_clubs')
      .select('id,name,city,region,latitude,longitude'),
    supabase.auth.getUser(),
  ]);

  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

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
    clubs,
    homeClubCoords,
    savedClubIds,
    isLoggedIn: !!user,
  };
}

export default async function TurnierePage() {
  const { clubs, homeClubCoords, savedClubIds, isLoggedIn } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Turnierkalender</h1>
      <p className="text-gray-500 text-sm mb-6">
        Alle Golfturniere in Deutschland
      </p>
      <Suspense>
        <TurniereClient clubs={clubs} homeClubCoords={homeClubCoords} savedClubIds={savedClubIds} isLoggedIn={isLoggedIn} />
      </Suspense>
    </div>
  );
}
