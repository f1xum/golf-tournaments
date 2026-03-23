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

  // Fetch the actual tournament data for saved tournaments
  const savedIds = (savedRows ?? []).map((r) => r.tournament_id);
  let savedTournaments: Tournament[] = [];
  let savedClubs: Record<string, GolfClub> = {};

  if (savedIds.length > 0) {
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', savedIds)
      .gte('date_start', today)
      .order('date_start', { ascending: true });

    savedTournaments = (tournaments ?? []) as Tournament[];

    // Get clubs for these tournaments
    const clubIds = [...new Set(savedTournaments.map((t) => t.club_id).filter(Boolean))];
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

      <SavedTournaments tournaments={savedTournaments} clubs={savedClubs} />
    </div>
  );
}
