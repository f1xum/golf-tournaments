'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { GolfClub, Tournament } from '@/lib/types';
import { MapPin, ExternalLink, Phone, Mail, Calendar, Clock, ChevronDown, Flag } from 'lucide-react';
import WeekCalendar from '@/components/week-calendar';
import TournamentList from '@/components/tournament-list';
import SaveClubButton from '@/components/save-club-button';

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
  upcoming: Tournament[];
  past: Tournament[];
}

export default function ClubDetailClient({ club, upcoming, past }: Props) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [showPast, setShowPast] = useState(false);

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
      <div className="flex items-start gap-4 mb-4">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={`${club.name} Logo`}
            className="w-14 h-14 rounded-lg object-contain bg-white border border-gray-200 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-accent-light border border-accent/20 shrink-0 flex items-center justify-center dark:bg-[#1a3329] dark:border-[#2d4a3a]">
            <Flag size={24} className="text-accent" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h1 className="text-2xl font-bold">{club.name}</h1>
            <SaveClubButton clubId={club.id} />
          </div>
          {(club.city || club.region) && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin size={14} />
              <span>{[club.city, club.region].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
      </div>

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
        {upcoming.length > 0 && (
          <span className="text-xs bg-accent-light text-accent px-2 py-0.5 rounded-full font-medium">
            {upcoming.length}
          </span>
        )}
      </div>

      {upcoming.length === 0 ? (
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
            <WeekCalendar tournaments={upcoming} clubs={clubsMap} />
          ) : (
            <TournamentList tournaments={upcoming} clubs={clubsMap} />
          )}
        </>
      )}

      {/* Past tournaments */}
      {past.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowPast(!showPast)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">
                Vergangene Turniere
              </span>
              <span className="text-xs text-gray-400">
                {past.length}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${showPast ? 'rotate-180' : ''}`}
            />
          </button>

          {showPast && (
            <div className="mt-3">
              <TournamentList tournaments={past} clubs={clubsMap} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
