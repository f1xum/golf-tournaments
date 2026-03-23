'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { GolfClub, Tournament } from '@/lib/types';
import { MapPin, ExternalLink, Phone, Mail, Calendar } from 'lucide-react';
import WeekCalendar from '@/components/week-calendar';
import TournamentList from '@/components/tournament-list';

const ClubMapMini = dynamic(() => import('@/components/club-map-mini'), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
      Karte wird geladen...
    </div>
  ),
});

interface Props {
  club: GolfClub;
  tournaments: Tournament[];
}

export default function ClubDetailClient({ club, tournaments }: Props) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const clubsMap = { [club.id]: club };

  return (
    <div className="py-6">
      {/* Back link */}
      <Link
        href="/clubs"
        className="inline-flex items-center text-sm text-gray-500 hover:text-accent mb-4"
      >
        ← Zurück zu Clubs
      </Link>

      {/* Club header */}
      <h1 className="text-2xl font-bold mb-1">{club.name}</h1>
      {(club.city || club.region) && (
        <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
          <MapPin size={14} />
          <span>{[club.city, club.region].filter(Boolean).join(', ')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Club info */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="space-y-2 text-sm text-gray-600">
            {club.address && <div>{club.address}</div>}
            {(club.postal_code || club.city) && (
              <div>{[club.postal_code, club.city].filter(Boolean).join(' ')}</div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {club.website && (
              <a
                href={club.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-accent hover:underline"
              >
                <ExternalLink size={14} />
                Website
              </a>
            )}
            {club.phone && (
              <a href={`tel:${club.phone}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                <Phone size={14} />
                {club.phone}
              </a>
            )}
            {club.email && (
              <a href={`mailto:${club.email}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                <Mail size={14} />
                {club.email}
              </a>
            )}
          </div>
        </div>

        {/* Map */}
        {club.latitude && club.longitude ? (
          <div className="md:col-span-2 h-[250px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <ClubMapMini club={club} />
          </div>
        ) : (
          <div className="md:col-span-2" />
        )}
      </div>

      {/* Tournaments section */}
      <div className="flex items-center gap-3 mb-4">
        <Calendar size={18} className="text-accent" />
        <h2 className="text-lg font-bold">Kommende Turniere</h2>
        {tournaments.length > 0 && (
          <span className="text-xs bg-accent-light text-accent px-2 py-0.5 rounded-full font-medium">
            {tournaments.length}
          </span>
        )}
      </div>

      {tournaments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Keine kommenden Turniere bei diesem Club.</p>
        </div>
      ) : (
        <>
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
            <button
              onClick={() => setView('calendar')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kalender
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Liste
            </button>
          </div>

          {view === 'calendar' ? (
            <WeekCalendar tournaments={tournaments} clubs={clubsMap} />
          ) : (
            <TournamentList tournaments={tournaments} clubs={clubsMap} />
          )}
        </>
      )}
    </div>
  );
}
