import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Building2, CalendarDays, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import { BUNDESLAENDER, bundeslandBySlug } from '@/lib/regions';
import { loadClubsByBundesland } from '@/lib/geo-data';
import TournamentCard from '@/components/tournament-card';

export const revalidate = 3600;

const YEAR = new Date().getFullYear();
const MAX_TOURNAMENTS = 150;

interface PageProps {
  params: Promise<{ bundesland: string }>;
}

export function generateStaticParams() {
  return BUNDESLAENDER.map((b) => ({ bundesland: b.slug }));
}

async function getData(slug: string) {
  const bl = bundeslandBySlug(slug);
  if (!bl) return null;

  const supabase = await createClient();
  const today = todayISO();

  const clubsByBl = await loadClubsByBundesland(supabase);
  const clubs = clubsByBl.get(slug) ?? [];
  const clubIds = clubs.map((c) => c.id);

  let tournaments: Tournament[] = [];
  if (clubIds.length > 0) {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .in('club_id', clubIds)
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(MAX_TOURNAMENTS);
    tournaments = (data ?? []) as Tournament[];
  }

  return { bl, clubs, tournaments };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bundesland } = await params;
  const bl = bundeslandBySlug(bundesland);
  if (!bl) return { title: 'Nicht gefunden' };

  const title = `Golfturniere in ${bl.name} ${YEAR} – Termine & Golfclubs`;
  const description = `Alle kommenden Golfturniere in ${bl.name} auf einen Blick: Termine, Nenngeld, HCP und Anmeldung. Finde dein nächstes Turnier bei Golfclubs in ${bl.name} – kostenlos auf The Pin.`;
  const url = `https://thepin.app/golfturniere/${bl.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'website', url, siteName: 'The Pin', locale: 'de_DE' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function BundeslandPage({ params }: PageProps) {
  const { bundesland } = await params;
  const data = await getData(bundesland);
  if (!data) notFound();

  const { bl, clubs, tournaments } = data;
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  // Cities in this Bundesland with their club counts (for internal linking + unique copy).
  const cityCounts = new Map<string, number>();
  for (const c of clubs) {
    if (c.city) cityCounts.set(c.city, (cityCounts.get(c.city) ?? 0) + 1);
  }
  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([city]) => city);

  const otherBl = BUNDESLAENDER.filter((b) => b.slug !== bl.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://thepin.app' },
          { '@type': 'ListItem', position: 2, name: 'Golfturniere', item: 'https://thepin.app/golfturniere' },
          { '@type': 'ListItem', position: 3, name: bl.name, item: `https://thepin.app/golfturniere/${bl.slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Golfturniere in ${bl.name}`,
        numberOfItems: tournaments.length,
        itemListElement: tournaments.slice(0, 25).map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'SportsEvent',
            name: t.name,
            startDate: t.date_start,
            endDate: t.date_end || t.date_start,
            sport: 'Golf',
            url: `https://thepin.app/turniere/${t.id}`,
            ...(clubById.get(t.club_id || '') && {
              location: {
                '@type': 'Place',
                name: clubById.get(t.club_id || '')!.name,
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: clubById.get(t.club_id || '')!.city || undefined,
                  addressRegion: bl.name,
                  addressCountry: 'DE',
                },
              },
            }),
          },
        })),
      },
    ],
  };

  return (
    <div className="py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1.5 flex-wrap" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gray-600">Start</Link>
        <span aria-hidden="true">/</span>
        <Link href="/golfturniere" className="hover:text-gray-600">Golfturniere</Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-600">{bl.name}</span>
      </nav>

      {/* Hero */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold leading-tight">
          Golfturniere in {bl.name}
        </h1>
        <p className="text-gray-600 mt-2 leading-relaxed">
          {tournaments.length > 0 ? (
            <>
              <strong>{tournaments.length}</strong> kommende Golfturniere bei{' '}
              <strong>{clubs.length}</strong> Golfclubs in {bl.name} – mit Terminen, Nenngeld,
              HCP-Grenzen und direkter Anmeldung. Neu, HCP-relevant oder mit freien Plätzen:
              filtere und speichere deine Turniere kostenlos auf The Pin.
            </>
          ) : (
            <>
              Aktuell sind keine kommenden Golfturniere für {bl.name} gelistet. Entdecke die{' '}
              <strong>{clubs.length}</strong> Golfclubs in {bl.name} oder schau bald wieder vorbei –
              wir aktualisieren die Turniere täglich.
            </>
          )}
        </p>
        {topCities.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Beliebte Golfregionen in {bl.name}: {topCities.join(', ')}.
          </p>
        )}
      </header>

      {/* Tournament list */}
      {tournaments.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-accent" />
            Kommende Turniere in {bl.name}
          </h2>
          <div className="space-y-3">
            {tournaments.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                club={clubById.get(t.club_id || '')}
                userId={null}
                initialSaved={false}
              />
            ))}
          </div>
          <div className="mt-4">
            <Link href="/turniere" className="text-accent text-sm font-medium inline-flex items-center gap-1 hover:underline">
              Alle Turniere durchsuchen & filtern <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Clubs in this Bundesland — internal links */}
      {clubs.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent" />
            Golfclubs in {bl.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {clubs.map((c) => (
              <Link
                key={c.id}
                href={`/clubs/${c.id}`}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm hover:shadow-sm hover:border-accent/30 transition-all"
              >
                <MapPin className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="font-medium truncate">{c.name}</span>
                {c.city && <span className="text-gray-400 truncate">· {c.city}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Other Bundesländer — internal links / crawl paths */}
      <section className="border-t border-gray-100 pt-6">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Golfturniere in anderen Bundesländern</h2>
        <div className="flex flex-wrap gap-2">
          {otherBl.map((b) => (
            <Link
              key={b.slug}
              href={`/golfturniere/${b.slug}`}
              className="text-sm px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full hover:border-accent/40 hover:text-accent transition-colors"
            >
              {b.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
