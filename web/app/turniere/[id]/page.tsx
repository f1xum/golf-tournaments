import { supabase } from '@/lib/supabase';
import { GolfClub, Tournament } from '@/lib/types';
import { notFound } from 'next/navigation';
import TurnierDetailClient from './client';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTournament(id: string) {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (!tournament) return null;

  let club: GolfClub | null = null;
  if (tournament.club_id) {
    const { data } = await supabase
      .from('golf_clubs')
      .select('*')
      .eq('id', tournament.club_id)
      .single();
    club = data as GolfClub | null;
  }

  return { tournament: tournament as Tournament, club };
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const result = await getTournament(id);
  if (!result) return { title: 'Turnier nicht gefunden' };

  const { tournament, club } = result;
  return {
    title: `${tournament.name}${club ? ` – ${club.name}` : ''}`,
    description: `Golfturnier am ${tournament.date_start}${club?.city ? ` in ${club.city}` : ''}`,
  };
}

export default async function TurnierDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getTournament(id);
  if (!result) notFound();

  return (
    <div className="py-6">
      <TurnierDetailClient tournament={result.tournament} club={result.club} />
    </div>
  );
}
