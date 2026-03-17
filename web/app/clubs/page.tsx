import { supabase } from '@/lib/supabase';
import { GolfClub } from '@/lib/types';
import ClubsClient from './client';

export const revalidate = 3600;

async function getClubs() {
  const { data } = await supabase
    .from('golf_clubs')
    .select('*')
    .order('name', { ascending: true });

  return (data ?? []) as GolfClub[];
}

export default async function ClubsPage() {
  const clubs = await getClubs();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Golfclubs</h1>
      <p className="text-gray-500 text-sm mb-6">
        {clubs.length} Golfclubs in Bayern
      </p>
      <ClubsClient clubs={clubs} />
    </div>
  );
}
