import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Profile, GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import UserHub from './user-hub';
import RecommendationPrefs from './recommendation-prefs';
import SavedTournaments from './saved-tournaments';
import SavedClubs from './saved-clubs';

export const metadata = {
  title: 'Mein Bereich – The Pin',
};

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const today = todayISO();

  const [{ data: profile }, { data: savedRows }, { data: savedClubRows }, { count: unreadCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('saved_tournaments')
      .select('tournament_id')
      .eq('user_id', user.id),
    supabase
      .from('saved_clubs')
      .select('club_id')
      .eq('user_id', user.id),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false),
  ]);

  // Fetch home club name
  let homeClubName: string | null = null;
  if (profile?.home_club_id) {
    const { data: club } = await supabase
      .from('golf_clubs')
      .select('name')
      .eq('id', profile.home_club_id)
      .single();
    homeClubName = club?.name ?? null;
  }

  // Saved clubs
  const savedClubIds = (savedClubRows ?? []).map((r) => r.club_id);
  let favoriteClubs: GolfClub[] = [];
  if (savedClubIds.length > 0) {
    const { data: clubList } = await supabase
      .from('golf_clubs')
      .select('id, name, city, region')
      .in('id', savedClubIds);
    favoriteClubs = (clubList ?? []) as GolfClub[];
  }

  const savedIds = (savedRows ?? []).map((r) => r.tournament_id);
  let upcomingTournaments: Tournament[] = [];
  let pastTournaments: Tournament[] = [];
  let savedClubs: Record<string, GolfClub> = {};

  if (savedIds.length > 0) {
    const [{ data: upcoming }, { data: past }] = await Promise.all([
      supabase
        .from('tournaments')
        .select('*')
        .in('id', savedIds)
        .gte('date_start', today)
        .order('date_start', { ascending: true }),
      supabase
        .from('tournaments')
        .select('*')
        .in('id', savedIds)
        .lt('date_start', today)
        .order('date_start', { ascending: false }),
    ]);

    upcomingTournaments = (upcoming ?? []) as Tournament[];
    pastTournaments = (past ?? []) as Tournament[];

    const allTournaments = [...upcomingTournaments, ...pastTournaments];
    const clubIds = [...new Set(allTournaments.map((t) => t.club_id).filter(Boolean))];
    if (clubIds.length > 0) {
      const { data: clubData } = await supabase
        .from('golf_clubs')
        .select('id, name, city, region')
        .in('id', clubIds);
      (clubData ?? []).forEach((c) => {
        savedClubs[c.id] = c as GolfClub;
      });
    }
  }

  return (
    <div className="py-6 max-w-lg mx-auto">
      <UserHub
        profile={profile as Profile | null}
        email={user.email ?? ''}
        homeClubName={homeClubName}
        savedCount={savedIds.length}
        savedClubCount={savedClubIds.length}
        unreadCount={unreadCount ?? 0}
      />

      <RecommendationPrefs profile={profile as Profile | null} />

      <SavedClubs clubs={favoriteClubs} />

      <SavedTournaments
        upcoming={upcomingTournaments}
        past={pastTournaments}
        clubs={savedClubs}
      />
    </div>
  );
}
