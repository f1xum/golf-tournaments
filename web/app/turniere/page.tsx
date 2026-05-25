import { Suspense } from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { GolfClub } from '@/lib/types';
import { ScoringProfile } from '@/lib/recommendations';
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
  let savedTournamentIds: string[] = [];
  let scoringProfile: ScoringProfile | null = null;
  const user = userRes.data?.user;
  if (user) {
    const [{ data: profile }, { data: savedClubs }, { data: savedTournaments }] = await Promise.all([
      supabase
        .from('profiles')
        .select('handicap,home_club_id,recommendation_max_distance,recommendation_prefer_hcp,recommendation_formats')
        .eq('id', user.id)
        .single(),
      supabase
        .from('saved_clubs')
        .select('club_id')
        .eq('user_id', user.id),
      supabase
        .from('saved_tournaments')
        .select('tournament_id')
        .eq('user_id', user.id),
    ]);
    if (profile?.home_club_id) {
      const hc = clubs[profile.home_club_id];
      if (hc?.latitude && hc?.longitude) {
        homeClubCoords = [hc.latitude, hc.longitude];
      }
    }
    if (profile) {
      scoringProfile = profile as ScoringProfile;
    }
    savedClubIds = (savedClubs ?? []).map((r) => r.club_id);
    savedTournamentIds = (savedTournaments ?? []).map((r) => r.tournament_id);
  }

  return {
    clubs,
    homeClubCoords,
    savedClubIds,
    savedTournamentIds,
    scoringProfile,
    userId: user?.id ?? null,
    isLoggedIn: !!user,
  };
}

export default async function TurnierePage() {
  const { clubs, homeClubCoords, savedClubIds, savedTournamentIds, scoringProfile, userId, isLoggedIn } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Turnierkalender</h1>
      <p className="text-gray-500 text-sm mb-6">
        Alle Golfturniere in Deutschland
      </p>
      <Suspense>
        <TurniereClient
          clubs={clubs}
          homeClubCoords={homeClubCoords}
          savedClubIds={savedClubIds}
          savedTournamentIds={savedTournamentIds}
          scoringProfile={scoringProfile}
          userId={userId}
          isLoggedIn={isLoggedIn}
        />
      </Suspense>
    </div>
  );
}
