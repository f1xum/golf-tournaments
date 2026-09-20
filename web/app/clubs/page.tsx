import { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { GolfClub } from '@/lib/types';
import ClubsClient from './client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Golfclubs in Deutschland – Alle Clubs im Überblick',
  description: 'Über 800 Golfclubs in Deutschland mit Turnierkalender, Kontaktdaten und Karte. Finde deinen Golfclub auf The Pin.',
  alternates: { canonical: 'https://thepin.app/clubs' },
};

async function getData() {
  const supabase = createPublicClient();

  const { data: clubs } = await supabase
    .from('golf_clubs')
    .select('*')
    .order('name', { ascending: true });

  return {
    // Hide rows merged into another club — they are the same course listed
    // twice, and the duplicate is the copy with no tournaments on it.
    clubs: ((clubs ?? []) as GolfClub[]).filter((c) => !c.merged_into),
  };
}

export default async function ClubsPage() {
  const { clubs } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Golfclubs</h1>
      <p className="text-gray-500 text-sm mb-6">
        {clubs.length} Golfclubs in Deutschland
      </p>
      <ClubsClient clubs={clubs} />
    </div>
  );
}
