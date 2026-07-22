import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils';
import { BUNDESLAENDER } from '@/lib/regions';
import { loadClubsByBundesland, loadUpcomingCountsByBundesland } from '@/lib/geo-data';

export const revalidate = 3600;

const YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: `Golfturniere in Deutschland ${YEAR} – nach Bundesland`,
  description: `Finde Golfturniere in ganz Deutschland – übersichtlich nach Bundesland. Termine, Nenngeld, HCP und Anmeldung für tausende Turniere bei über 800 Golfclubs. Kostenlos auf The Pin.`,
  alternates: { canonical: 'https://thepin.app/golfturniere' },
  openGraph: {
    title: `Golfturniere in Deutschland ${YEAR} – nach Bundesland`,
    description: 'Golfturniere in ganz Deutschland, übersichtlich nach Bundesland. Termine, Nenngeld, HCP und Anmeldung.',
    type: 'website',
    url: 'https://thepin.app/golfturniere',
    siteName: 'The Pin',
    locale: 'de_DE',
  },
};

export default async function GolfturniereIndexPage() {
  const supabase = await createClient();
  const today = todayISO();

  const clubsByBl = await loadClubsByBundesland(supabase);
  const counts = await loadUpcomingCountsByBundesland(supabase, clubsByBl, today);

  const rows = BUNDESLAENDER.map((b) => ({
    ...b,
    clubs: clubsByBl.get(b.slug)?.length ?? 0,
    tournaments: counts.get(b.slug) ?? 0,
  })).sort((a, b) => b.tournaments - a.tournaments);

  const totalTournaments = rows.reduce((s, r) => s + r.tournaments, 0);
  const totalClubs = rows.reduce((s, r) => s + r.clubs, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://thepin.app' },
      { '@type': 'ListItem', position: 2, name: 'Golfturniere', item: 'https://thepin.app/golfturniere' },
    ],
  };

  return (
    <div className="py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mb-6">
        <h1 className="text-2xl font-bold leading-tight">Golfturniere in Deutschland</h1>
        <p className="text-gray-600 mt-2 leading-relaxed">
          Über <strong>{totalTournaments}</strong> kommende Golfturniere bei{' '}
          <strong>{totalClubs}</strong> Golfclubs – nach Bundesland sortiert. Wähle deine Region
          und finde Termine, Nenngeld, HCP-Grenzen und die direkte Anmeldung.
        </p>
      </header>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((r) => (
            <Link
              key={r.slug}
              href={`/golfturniere/${r.slug}`}
              className="group flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-accent flex-shrink-0" />
                <div>
                  <div className="font-semibold">Golfturniere in {r.name}</div>
                  <div className="text-xs text-gray-500">
                    {r.tournaments > 0 ? `${r.tournaments} Turniere · ` : ''}{r.clubs} Golfclubs
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-accent transition-colors" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
