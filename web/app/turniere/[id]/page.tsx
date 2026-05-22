import { createClient } from '@/lib/supabase/server';
import { GolfClub, Tournament } from '@/lib/types';
import { notFound } from 'next/navigation';
import TurnierDetailClient from './client';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTournament(id: string) {
  const supabase = await createClient();
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

  const { tournament: t, club } = result;
  const dateFormatted = new Date(t.date_start + 'T00:00:00').toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const clubInfo = club ? ` bei ${club.name}` : '';
  const cityInfo = club?.city ? ` in ${club.city}` : '';

  const title = `${t.name}${clubInfo} | The Pin`;
  const description = `Golfturnier am ${dateFormatted}${cityInfo}. ${
    t.entry_fee != null ? `Nenngeld: ${t.entry_fee} €. ` : ''
  }${t.format ? `Format: ${t.format}. ` : ''}Jetzt auf The Pin ansehen und anmelden.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://thepin.app/turniere/${id}`,
      siteName: 'The Pin',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: `https://thepin.app/turniere/${id}`,
    },
  };
}

export default async function TurnierDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getTournament(id);
  if (!result) notFound();

  const { tournament: t, club } = result;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  let initialSaved = false;
  if (user) {
    const { data: savedRow } = await supabase
      .from('saved_tournaments')
      .select('tournament_id')
      .eq('user_id', user.id)
      .eq('tournament_id', id)
      .maybeSingle();
    initialSaved = !!savedRow;
  }

  // JSON-LD structured data for Google
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: t.name,
    startDate: t.date_start,
    endDate: t.date_end || t.date_start,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(club && {
      location: {
        '@type': 'Place',
        name: club.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: club.address || undefined,
          addressLocality: club.city || undefined,
          postalCode: club.postal_code || undefined,
          addressRegion: club.region || undefined,
          addressCountry: 'DE',
        },
        ...(club.latitude && club.longitude && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: club.latitude,
            longitude: club.longitude,
          },
        }),
      },
    }),
    ...(t.entry_fee != null && {
      offers: {
        '@type': 'Offer',
        price: t.entry_fee,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `https://thepin.app/turniere/${id}`,
      },
    }),
    sport: 'Golf',
    url: `https://thepin.app/turniere/${id}`,
    organizer: club ? {
      '@type': 'SportsOrganization',
      name: club.name,
      ...(club.website && { url: club.website }),
    } : undefined,
  };

  return (
    <div className="py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TurnierDetailClient
        tournament={t}
        club={club}
        isLoggedIn={isLoggedIn}
        userId={user?.id ?? null}
        initialSaved={initialSaved}
      />
    </div>
  );
}
