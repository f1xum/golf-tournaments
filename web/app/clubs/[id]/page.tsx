import { createPublicClient } from '@/lib/supabase/public';
import { notFound, permanentRedirect } from 'next/navigation';
import { GolfClub, Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import ClubDetailClient from './client';

// Crawlers walk every club URL, and each stale hit regenerates the page. Club
// pages change rarely, so a day is plenty.
export const revalidate = 86400;

// No params at build time — these pages are generated on first request and then
// cached for `revalidate`. Without this, Next treats the segment as fully
// dynamic and re-renders it for every visitor and every crawler.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createPublicClient();
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
  const supabase = createPublicClient();
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

  // This row is a duplicate of another club, and the tournaments live on the
  // keeper. Send the user (and Google) there rather than rendering a club that
  // looks like it never hosts anything. Permanent, because these URLs are
  // already indexed and the merge is not going to be undone.
  if (club.merged_into) permanentRedirect(`/clubs/${club.merged_into}`);

  return (
    <ClubDetailClient
      club={club as GolfClub}
      upcoming={(upcoming ?? []) as Tournament[]}
      past={(past ?? []) as Tournament[]}
    />
  );
}
