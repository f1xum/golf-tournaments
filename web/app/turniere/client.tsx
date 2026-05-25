'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Tournament, GolfClub } from '@/lib/types';
import { distanceKm } from '@/lib/utils';
import { extractHoles } from '@/lib/tournament-utils';
import { ScoringProfile } from '@/lib/recommendations';
import TournamentFilters, { Filters, DEFAULT_FILTERS } from '@/components/tournament-filters';
import { FORMAT_FILTER_SYNONYMS } from '@/lib/constants';
import WeekCalendar from '@/components/week-calendar';
import TournamentList from '@/components/tournament-list';
import PullToRefresh from '@/components/pull-to-refresh';
import { ChevronDown, Clock, Lock, Search, X } from 'lucide-react';

interface Props {
  clubs: Record<string, GolfClub>;
  homeClubCoords: [number, number] | null;
  savedClubIds: string[];
  savedTournamentIds: string[];
  scoringProfile: ScoringProfile | null;
  userId: string | null;
  isLoggedIn: boolean;
}

function applyFilters(
  tournaments: Tournament[],
  filters: Filters,
  clubs: Record<string, GolfClub>,
  refPoint: [number, number] | null,
  savedClubIds: string[],
  search: string,
) {
  const q = search.toLowerCase().trim();
  return tournaments.filter((t) => {
    const raw = t.raw_data || {};

    if (q) {
      const club = clubs[t.club_id || ''];
      const haystack = `${t.name} ${club?.name || ''} ${club?.city || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

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
    if (filters.format) {
      const allowed = FORMAT_FILTER_SYNONYMS[filters.format] ?? [filters.format];
      if (!allowed.includes(t.format || '')) return false;
    }
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

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-5 w-16 bg-gray-100 rounded" />
          </div>
          <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-1/2 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

const STATE_STORAGE_KEY = 'thepin-turniere-state';

export default function TurniereClient({ clubs, homeClubCoords, savedClubIds, savedTournamentIds, scoringProfile, userId, isLoggedIn }: Props) {
  const savedTournamentIdSet = useMemo(() => new Set(savedTournamentIds), [savedTournamentIds]);
  const savedClubIdSet = useMemo(() => new Set(savedClubIds), [savedClubIds]);
  const searchParams = useSearchParams();
  const clubParam = searchParams.get('club') ?? '';
  const queryClient = useQueryClient();

  const refreshTournaments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tournaments', 'upcoming'] }),
      queryClient.invalidateQueries({ queryKey: ['tournaments', 'past'] }),
    ]);
  };

  const [view, setView] = useState<'calendar' | 'list'>(isLoggedIn ? 'calendar' : 'list');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const [showPast, setShowPast] = useState(false);
  const hydratedRef = useRef(false);

  const [showLoginToast, setShowLoginToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  // Tournament data — cached in React Query, persisted to localStorage.
  // On repeat visits the list paints instantly from cache while a fresh
  // copy is revalidated in the background.
  const { data: upcoming = [], isPending: upcomingLoading } = useQuery<Tournament[]>({
    queryKey: ['tournaments', 'upcoming'],
    queryFn: async () => {
      const r = await fetch('/api/tournaments/upcoming');
      if (!r.ok) throw new Error('Failed to load tournaments');
      return r.json();
    },
  });

  const { data: past = [], isFetching: pastLoading } = useQuery<Tournament[]>({
    queryKey: ['tournaments', 'past'],
    queryFn: async () => {
      const r = await fetch('/api/tournaments/past');
      if (!r.ok) throw new Error('Failed to load tournaments');
      return r.json();
    },
    enabled: showPast,
  });

  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    club: clubParam,
  });
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  // Rehydrate filters/search/view/showPast from sessionStorage on mount so
  // navigating to a detail page and back preserves the user's exploration state.
  // ?club=… in the URL always wins, since it's an explicit intent.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STATE_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.filters) {
          setFilters({
            ...DEFAULT_FILTERS,
            ...saved.filters,
            club: clubParam || saved.filters.club || '',
          });
        }
        if (typeof saved.search === 'string') setSearch(saved.search);
        if (saved.view === 'calendar' || saved.view === 'list') setView(saved.view);
        if (typeof saved.showPast === 'boolean') setShowPast(saved.showPast);
      }
    } catch {}
    hydratedRef.current = true;
  }, [clubParam]);

  // Persist state on change (only after the initial hydration pass).
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(
        STATE_STORAGE_KEY,
        JSON.stringify({ filters, search, view, showPast })
      );
    } catch {}
  }, [filters, search, view, showPast]);

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
    () => applyFilters(upcoming, filters, clubs, refPoint, savedClubIds, search),
    [upcoming, clubs, filters, refPoint, savedClubIds, search]
  );

  const filteredPast = useMemo(
    () => applyFilters(past, filters, clubs, refPoint, savedClubIds, search),
    [past, clubs, filters, refPoint, savedClubIds, search]
  );

  const activeClub = filters.club ? clubs[filters.club] : null;

  return (
    <PullToRefresh onRefresh={refreshTournaments}>
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

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          placeholder="Turnier oder Club suchen..."
          onFocus={() => setView('list')}
          onChange={(e) => {
            setSearch(e.target.value);
            if (view !== 'list') setView('list');
          }}
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); searchRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

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
        {!upcomingLoading && (
          <span className="text-xs text-gray-400">
            {filteredUpcoming.length} Turnier{filteredUpcoming.length !== 1 ? 'e' : ''}
          </span>
        )}
      </div>

      {upcomingLoading ? (
        <LoadingSkeleton />
      ) : view === 'calendar' ? (
        <WeekCalendar tournaments={[...filteredUpcoming, ...filteredPast]} clubs={clubs} />
      ) : (
        <TournamentList tournaments={filteredUpcoming} clubs={clubs} savedTournamentIds={savedTournamentIdSet} userId={userId} scoringProfile={scoringProfile} savedClubIds={savedClubIdSet} />
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
              Vergangene Turniere (letzte 6 Tage)
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
              <TournamentList tournaments={filteredPast} clubs={clubs} savedTournamentIds={savedTournamentIdSet} userId={userId} />
            ) : (
              <div className="text-center py-8 text-sm text-gray-400">
                Keine vergangenen Turniere gefunden
              </div>
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
