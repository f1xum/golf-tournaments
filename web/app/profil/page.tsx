import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Profile, GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import ProfileForm from './profile-form';
import SavedTournaments from './saved-tournaments';

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const today = todayISO();

  const [{ data: profile }, { data: clubs }, { data: savedRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('golf_clubs').select('id, name, city').order('name'),
    supabase
      .from('saved_tournaments')
      .select('tournament_id')
      .eq('user_id', user.id),
  ]);

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

    // Get clubs for all saved tournaments
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
      <h1 className="text-2xl font-bold mb-6">Mein Profil</h1>
      <ProfileForm
        profile={profile as Profile | null}
        clubs={(clubs ?? []) as Pick<GolfClub, 'id' | 'name' | 'city'>[]}
        email={user.email ?? ''}
      />

      <SavedTournaments
        upcoming={upcomingTournaments}
        past={pastTournaments}
        clubs={savedClubs}
      />
    </div>
  );
}
