import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import ClubDetailClient from './client';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: club } = await supabase
    .from('golf_clubs')
    .select('name, city')
    .eq('id', id)
    .single();

  if (!club) return { title: 'Club nicht gefunden' };
  return {
    title: `${club.name} – Turniere | The Pin`,
    description: `Turniere bei ${club.name}${club.city ? ` in ${club.city}` : ''}`,
  };
}

export default async function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: club }, { data: upcoming }, { data: past }] = await Promise.all([
    supabase.from('golf_clubs').select('*').eq('id', id).single(),
    supabase
      .from('tournaments')
      .select('*')
      .eq('club_id', id)
      .gte('date_start', today)
      .order('date_start', { ascending: true }),
    supabase
      .from('tournaments')
      .select('*')
      .eq('club_id', id)
      .lt('date_start', today)
      .order('date_start', { ascending: false })
      .limit(100),
  ]);

  if (!club) notFound();

  return (
    <ClubDetailClient
      club={club as GolfClub}
      upcoming={(upcoming ?? []) as Tournament[]}
      past={(past ?? []) as Tournament[]}
    />
  );
}
