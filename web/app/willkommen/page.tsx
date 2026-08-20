import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GolfClub } from '@/lib/types';
import OnboardingClient from './client';

export default async function WillkommenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check if user already completed onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: clubsData } = await supabase
    .from('golf_clubs')
    .select('id,name,city')
    // Same reason as the settings picker: a merged duplicate is a dead end.
    .is('merged_into', null)
    .order('name');

  const clubs = (clubsData ?? []) as Pick<GolfClub, 'id' | 'name' | 'city'>[];

  return <OnboardingClient profile={profile} clubs={clubs} email={user.email ?? ''} />;
}
