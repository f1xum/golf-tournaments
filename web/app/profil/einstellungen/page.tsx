import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Profile, GolfClub } from '@/lib/types';
import SettingsClient from './client';

export const metadata = {
  title: 'Einstellungen – The Pin',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: clubs }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('golf_clubs').select('id, name, city').order('name'),
  ]);

  return (
    <div className="py-6 max-w-lg mx-auto">
      <SettingsClient
        profile={profile as Profile | null}
        clubs={(clubs ?? []) as Pick<GolfClub, 'id' | 'name' | 'city'>[]}
        email={user.email ?? ''}
      />
    </div>
  );
}
