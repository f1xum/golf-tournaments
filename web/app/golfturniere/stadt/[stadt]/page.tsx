import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Building2, CalendarDays, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Tournament } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import { CITIES, cityBySlug } from '@/lib/cities';
import { bundeslandBySlug } from '@/lib/regions';
import { loadAllClubs, clubsNearPoint, loadUpcomingTournaments } from '@/lib/geo-data';
import TournamentCard from '@/components/tournament-card';

export const revalidate = 3600;

const YEAR = new Date().getFullYear();

interface PageProps {
  params: Promise<{ stadt: string }>;
}

export function generateStaticParams() {
  return CITIES.map((c) => ({ stadt: c.slug }));
}

async function getData(slug: string) {
  const city = cityBySlug(slug);
  if (!city) return null;

  const supabase = await createClient();
  const today = todayISO();

  const allClubs = await loadAllClubs(supabase);
  const clubs = clubsNearPoint(allClubs, city.lat, city.lng, city.radiusKm);

  const tournaments = (await loadUpcomingTournaments(
    supabase,
    clubs.map((c) => c.id),
    today,
  )) as Tournament[];

  return { city, clubs, tournaments };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stadt } = await params;
  const city = cityBySlug(stadt);
  if (!city) return { title: 'Nicht gefunden' };

  const title = `Golfturniere in ${city.name} ${YEAR} – Termine & Golfclubs`;
  const description = `Alle kommenden Golfturniere in ${city.name} und Umgebung: Termine, Nenngeld, HCP und Anmeldung. Golfclubs im Umkreis von ${city.radiusKm} km rund um ${city.name} – kostenlos auf The Pin.`;
  const url = `https://thepin.app/golfturniere/stadt/${city.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'website', url, siteName: 'The Pin', locale: 'de_DE' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function StadtPage({ params }: PageProps) {
  const { stadt } = await params;
  const data = await getData(stadt);
  if (!data) notFound();

  const { city, clubs, tournaments } = data;
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const bl = bundeslandBySlug(city.bundesland);
  const otherCities = CITIES.filter((c) => c.slug !== city.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://thepin.app' },
          { '@type': 'ListItem', position: 2, name: 'Golfturniere', item: 'https://thepin.app/golfturniere' },
          ...(bl ? [{ '@type': 'ListItem', position: 3, name: bl.name, item: `https://thepin.app/golfturniere/${bl.slug}` }] : []),
          { '@type': 'ListItem', position: bl ? 4 : 3, name: city.name, item: `https://thepin.app/golfturniere/stadt/${city.slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `Golfturniere in ${city.name}`,
        numberOfItems: tournaments.length,
        itemListElement: tournaments.slice(0, 25).map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'SportsEvent',
            name: t.name,
            startDate: t.date_start,
            endDate: t.date_end || t.date_start,
            eventStatus: 'https://schema.org/EventScheduled',
            sport: 'Golf',
            url: `https://thepin.app/turniere/${t.id}`,
            ...(clubById.get(t.club_id || '') && {
              location: {
                '@type': 'Place',
                name: clubById.get(t.club_id || '')!.name,
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: clubById.get(t.club_id || '')!.city || undefined,
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
        {bl && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/golfturniere/${bl.slug}`} className="hover:text-gray-600">{bl.name}</Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-gray-600">{city.name}</span>
      </nav>

      {/* Hero */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold leading-tight">Golfturniere in {city.name}</h1>
        <p className="text-gray-600 mt-2 leading-relaxed">
          {tournaments.length > 0 ? (
            <>
              <strong>{tournaments.length}</strong> kommende Golfturniere bei{' '}
              <strong>{clubs.length}</strong> Golfclubs im Umkreis von {city.radiusKm} km rund um{' '}
              {city.name} – mit Terminen, Nenngeld, HCP-Grenzen und direkter Anmeldung. Filtere und
              speichere deine Turniere kostenlos auf The Pin.
            </>
          ) : (
            <>
              Aktuell sind keine kommenden Golfturniere rund um {city.name} gelistet. Entdecke die{' '}
              <strong>{clubs.length}</strong> Golfclubs im Umkreis oder schau bald wieder vorbei –
              wir aktualisieren die Turniere täglich.
            </>
          )}
        </p>
      </header>

      {/* Tournament list */}
      {tournaments.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-accent" />
            Kommende Turniere rund um {city.name}
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

      {/* Clubs — internal links */}
      {clubs.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent" />
            Golfclubs rund um {city.name}
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

      {/* Other cities + Bundesland link */}
      <section className="border-t border-gray-100 pt-6">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Golfturniere in anderen Städten</h2>
        <div className="flex flex-wrap gap-2">
          {bl && (
            <Link
              href={`/golfturniere/${bl.slug}`}
              className="text-sm px-3 py-1.5 bg-accent-light text-accent rounded-full hover:opacity-80 transition-opacity"
            >
              Ganz {bl.name}
            </Link>
          )}
          {otherCities.map((c) => (
            <Link
              key={c.slug}
              href={`/golfturniere/stadt/${c.slug}`}
              className="text-sm px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full hover:border-accent/40 hover:text-accent transition-colors"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
