import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Profile, GolfClub } from '@/lib/types';
import ProfileForm from './profile-form';

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: clubs }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('golf_clubs').select('id, name, city').order('name'),
  ]);

  return (
    <div className="py-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Mein Profil</h1>
      <p className="text-gray-500 text-sm mb-6">{user.email}</p>
      <ProfileForm
        profile={profile as Profile | null}
        clubs={(clubs ?? []) as Pick<GolfClub, 'id' | 'name' | 'city'>[]}
      />
    </div>
  );
}
