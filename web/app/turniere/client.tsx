'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tournament, GolfClub } from '@/lib/types';
import { distanceKm } from '@/lib/utils';
import { extractHoles } from '@/lib/tournament-utils';
import TournamentFilters, { Filters, DEFAULT_FILTERS } from '@/components/tournament-filters';
import WeekCalendar from '@/components/week-calendar';
import TournamentList from '@/components/tournament-list';
import { ChevronDown, Clock } from 'lucide-react';

interface Props {
  upcoming: Tournament[];
  past: Tournament[];
  clubs: Record<string, GolfClub>;
  homeClubCoords: [number, number] | null;
}

function applyFilters(
  tournaments: Tournament[],
  filters: Filters,
  clubs: Record<string, GolfClub>,
  refPoint: [number, number] | null,
) {
  return tournaments.filter((t) => {
    const raw = t.raw_data || {};

    if (filters.club && t.club_id !== filters.club) return false;
    if (filters.region) {
      const club = clubs[t.club_id || ''];
      if (!club || club.region !== filters.region) return false;
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

export default function TurniereClient({ upcoming, past, clubs, homeClubCoords }: Props) {
  const searchParams = useSearchParams();
  const clubParam = searchParams.get('club') ?? '';

  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [showPast, setShowPast] = useState(false);
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
    () => applyFilters(upcoming, filters, clubs, refPoint),
    [upcoming, clubs, filters, refPoint]
  );

  const filteredPast = useMemo(
    () => applyFilters(past, filters, clubs, refPoint),
    [past, clubs, filters, refPoint]
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

      <TournamentFilters
        filters={filters}
        onChange={setFilters}
        hasHomeClub={!!homeClubCoords}
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
        <WeekCalendar tournaments={filteredUpcoming} clubs={clubs} />
      ) : (
        <TournamentList tournaments={filteredUpcoming} clubs={clubs} />
      )}

      {/* Past tournaments toggle */}
      {filteredPast.length > 0 && (
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
                {filteredPast.length}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${showPast ? 'rotate-180' : ''}`}
            />
          </button>

          {showPast && (
            <div className="mt-3">
              <TournamentList tournaments={filteredPast} clubs={clubs} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
