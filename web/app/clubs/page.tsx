import { createClient } from '@/lib/supabase/server';
import { GolfClub } from '@/lib/types';
import ClubsClient from './client';

export const revalidate = 3600;

async function getData() {
  const supabase = await createClient();

  const [{ data: clubs }, userRes] = await Promise.all([
    supabase
      .from('golf_clubs')
      .select('*')
      .order('name', { ascending: true }),
    supabase.auth.getUser(),
  ]);

  let savedClubIds: string[] = [];
  if (userRes.data?.user) {
    const { data: saved } = await supabase
      .from('saved_clubs')
      .select('club_id')
      .eq('user_id', userRes.data.user.id);
    savedClubIds = (saved ?? []).map((r) => r.club_id);
  }

  return {
    clubs: (clubs ?? []) as GolfClub[],
    savedClubIds,
  };
}

export default async function ClubsPage() {
  const { clubs, savedClubIds } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Golfclubs</h1>
      <p className="text-gray-500 text-sm mb-6">
        {clubs.length} Golfclubs in Bayern
      </p>
      <ClubsClient clubs={clubs} savedClubIds={savedClubIds} />
    </div>
  );
}
