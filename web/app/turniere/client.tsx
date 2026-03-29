'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tournament, GolfClub } from '@/lib/types';
import { distanceKm } from '@/lib/utils';
import { extractHoles } from '@/lib/tournament-utils';
import TournamentFilters, { Filters, DEFAULT_FILTERS } from '@/components/tournament-filters';
import WeekCalendar from '@/components/week-calendar';
import TournamentList from '@/components/tournament-list';
import { ChevronDown, Clock, Lock } from 'lucide-react';

interface Props {
  upcoming: Tournament[];
  clubs: Record<string, GolfClub>;
  homeClubCoords: [number, number] | null;
  savedClubIds: string[];
  isLoggedIn: boolean;
}

function applyFilters(
  tournaments: Tournament[],
  filters: Filters,
  clubs: Record<string, GolfClub>,
  refPoint: [number, number] | null,
  savedClubIds: string[],
) {
  return tournaments.filter((t) => {
    const raw = t.raw_data || {};

    if (filters.favoriteClubs === 'yes' && !savedClubIds.includes(t.club_id || '')) return false;
    if (filters.club && t.club_id !== filters.club) return false;
    if (filters.region) {
      const club = clubs[t.club_id || ''];
      const region = club?.region || (t.source === 'bgv' ? 'Bayern' : null);
      if (region !== filters.region) return false;
    }
    // Distance
    if (filters.distance !== 'all' && refPoint) {
      const club = clubs[t.club_id || ''];
      if (!club?.latitude || !club?.longitude) return false;
      const dist = distanceKm(refPoint[0], refPoint[1], club.latitude, club.longitude);
      if (dist > parseInt(filters.distance)) return false;
    }
    if (filters.format && t.format !== filters.format) return false;
    if (filters.fee !== 'all') {
      const maxFee = parseInt(filters.fee);
      if (maxFee === 0 && t.entry_fee && t.entry_fee > 0) return false;
      if (maxFee > 0 && t.entry_fee && t.entry_fee > maxFee) return false;
    }
    if (filters.slots === 'yes') {
      if (raw.free_slots !== null && raw.free_slots !== undefined && raw.free_slots <= 0)
        return false;
    }
    if (filters.hcp === 'yes' && !raw.hcp_relevant) return false;
    if (filters.hcp === 'no' && raw.hcp_relevant) return false;
    if (filters.holes !== 'all') {
      const holes = extractHoles(t.raw_data, t.description);
      if (holes !== parseInt(filters.holes)) return false;
    }
    if (filters.gender !== 'all') {
      const g = (t.gender || '').toLowerCase();
      if (filters.gender === 'herren' && !g.includes('herr') && !g.includes('männ')) return false;
      if (filters.gender === 'damen' && !g.includes('dam') && !g.includes('frauen')) return false;
      if (filters.gender === 'mixed' && !g.includes('herren und damen') && !g.includes('mixed') && !g.includes('alle')) return false;
    }
    if (filters.visitors === 'yes') {
      if (!raw.guests_allowed) return false;
    }
    if (filters.age !== 'all') {
      const ac = (t.age_class || '').toLowerCase();
      if (filters.age === 'jugend' && !ac.includes('jugend') && !ac.includes('junior')) return false;
      if (filters.age === 'senioren' && !ac.includes('senior') && !ac.includes('ü50') && !ac.includes('ü60')) return false;
      if (filters.age === 'keine' && ac && ac !== 'alle' && ac !== 'allgemein') return false;
    }
    if (filters.sponsored === 'yes') {
      const prizes = raw.prizes;
      if (!prizes || !Array.isArray(prizes) || prizes.length === 0) return false;
    }

    return true;
  });
}

export default function TurniereClient({ upcoming, clubs, homeClubCoords, savedClubIds, isLoggedIn }: Props) {
  const searchParams = useSearchParams();
  const clubParam = searchParams.get('club') ?? '';

  const [view, setView] = useState<'calendar' | 'list'>(isLoggedIn ? 'calendar' : 'list');
  const [showPast, setShowPast] = useState(false);
  const [past, setPast] = useState<Tournament[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const pastLoaded = useRef(false);
  const [showLoginToast, setShowLoginToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  // Lazy-load past tournaments when user opens the section
  useEffect(() => {
    if (showPast && !pastLoaded.current) {
      pastLoaded.current = true;
      setPastLoading(true);
      fetch('/api/tournaments/past')
        .then((r) => r.json())
        .then((data) => setPast(data as Tournament[]))
        .finally(() => setPastLoading(false));
    }
  }, [showPast]);

  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    club: clubParam,
  });
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  // Scroll to top on mount to prevent focus jumping to calendar
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Request geolocation when distance filter is set to 'location'
  useEffect(() => {
    if (filters.distance !== 'all' && filters.distanceFrom === 'location' && !userPos) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
          () => {},
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    }
  }, [filters.distance, filters.distanceFrom, userPos]);

  // Determine the reference point for distance filtering
  const refPoint = filters.distanceFrom === 'homeclub' ? homeClubCoords : userPos;

  const filteredUpcoming = useMemo(
    () => applyFilters(upcoming, filters, clubs, refPoint, savedClubIds),
    [upcoming, clubs, filters, refPoint, savedClubIds]
  );

  const filteredPast = useMemo(
    () => applyFilters(past, filters, clubs, refPoint, savedClubIds),
    [past, clubs, filters, refPoint, savedClubIds]
  );

  const activeClub = filters.club ? clubs[filters.club] : null;

  return (
    <>
      {/* Club filter banner */}
      {activeClub && (
        <div className="flex items-center justify-between bg-accent-light border border-accent/20 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-sm font-medium text-accent">
            Turniere bei {activeClub.name}{activeClub.city ? ` (${activeClub.city})` : ''}
          </span>
          <button
            onClick={() => setFilters({ ...filters, club: '' })}
            className="text-xs text-accent hover:underline"
          >
            Alle anzeigen
          </button>
        </div>
      )}

      {/* View toggle */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
        <button
          onClick={() => {
            if (isLoggedIn) {
              setView('calendar');
            } else {
              setShowLoginToast(true);
              if (toastTimer.current) clearTimeout(toastTimer.current);
              toastTimer.current = setTimeout(() => setShowLoginToast(false), 4000);
            }
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            view === 'calendar'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          } ${!isLoggedIn ? 'opacity-60' : ''}`}
        >
          {!isLoggedIn && <Lock size={12} />}
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

      {/* Login toast for calendar */}
      {showLoginToast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[10001] animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3 whitespace-nowrap">
            <span>Melde dich an für die Kalender-Ansicht</span>
            <Link
              href="/login"
              className="text-accent-light font-medium hover:underline"
              onClick={() => setShowLoginToast(false)}
            >
              Anmelden →
            </Link>
          </div>
        </div>
      )}

      <TournamentFilters
        filters={filters}
        onChange={setFilters}
        hasHomeClub={!!homeClubCoords}
        hasFavoriteClubs={savedClubIds.length > 0}
      />

      {/* Distance status hint */}
      {filters.distance !== 'all' && filters.distanceFrom === 'location' && !userPos && (
        <div className="text-xs text-blue-500 mb-3 px-1">
          Standort wird ermittelt...
        </div>
      )}

      {/* Upcoming indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-accent"></div>
        <span className="text-sm font-medium text-gray-700">
          Kommende Turniere
        </span>
        <span className="text-xs text-gray-400">
          {filteredUpcoming.length} Turnier{filteredUpcoming.length !== 1 ? 'e' : ''}
        </span>
      </div>

      {view === 'calendar' ? (
        <WeekCalendar tournaments={[...filteredUpcoming, ...filteredPast]} clubs={clubs} />
      ) : (
        <TournamentList tournaments={filteredUpcoming} clubs={clubs} />
      )}

      {/* Past tournaments toggle */}
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
            {filteredPast.length > 0 && (
              <span className="text-xs text-gray-400">
                {filteredPast.length}
              </span>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${showPast ? 'rotate-180' : ''}`}
          />
        </button>

        {showPast && (
          <div className="mt-3">
            {pastLoading ? (
              <div className="text-center py-8 text-sm text-gray-400">
                Turniere werden geladen...
              </div>
            ) : filteredPast.length > 0 ? (
              <TournamentList tournaments={filteredPast} clubs={clubs} />
            ) : (
              <div className="text-center py-8 text-sm text-gray-400">
                Keine vergangenen Turniere gefunden
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
