import { Suspense } from 'react';
import { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { GolfClub } from '@/lib/types';
import TurniereClient from './client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Turnierkalender – Alle Golfturniere in Deutschland',
  description: 'Alle aktuellen Golfturniere in Deutschland auf einen Blick. Filtere nach Bundesland, Spielform, Nenngeld und mehr. Kostenlos auf The Pin.',
  alternates: { canonical: 'https://thepin.app/turniere' },
};

async function getData() {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from('golf_clubs')
    .select('id,name,city,region,latitude,longitude');

  const clubs: Record<string, GolfClub> = {};
  (data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  return { clubs };
}

export default async function TurnierePage() {
  // Saved tournaments, favourite clubs, the home club and the scoring profile
  // all load in the browser via `useViewer` — reading them here would make this
  // page dynamic and re-render it on every visit.
  const { clubs } = await getData();

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-1">Turnierkalender</h1>
      <p className="text-gray-500 text-sm mb-6">
        Alle Golfturniere in Deutschland
      </p>
      <Suspense>
        <TurniereClient clubs={clubs} />
      </Suspense>
    </div>
  );
}
