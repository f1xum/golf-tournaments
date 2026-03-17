'use client';

import { useState, useMemo } from 'react';
import { Tournament, GolfClub } from '@/lib/types';
import TournamentFilters, { Filters } from '@/components/tournament-filters';
import WeekCalendar from '@/components/week-calendar';
import TournamentList from '@/components/tournament-list';

interface Props {
  tournaments: Tournament[];
  clubs: Record<string, GolfClub>;
}

export default function TurniereClient({ tournaments, clubs }: Props) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filters, setFilters] = useState<Filters>({
    region: '',
    format: '',
    fee: 'all',
    slots: 'all',
  });

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      // Region
      if (filters.region) {
        const club = clubs[t.club_id || ''];
        if (!club || club.region !== filters.region) return false;
      }
      // Format
      if (filters.format && t.format !== filters.format) return false;
      // Fee
      if (filters.fee !== 'all') {
        const maxFee = parseInt(filters.fee);
        if (maxFee === 0 && t.entry_fee && t.entry_fee > 0) return false;
        if (maxFee > 0 && t.entry_fee && t.entry_fee > maxFee) return false;
      }
      // Slots
      if (filters.slots === 'yes') {
        const raw = t.raw_data || {};
        if (raw.free_slots !== null && raw.free_slots !== undefined && raw.free_slots <= 0)
          return false;
      }
      return true;
    });
  }, [tournaments, clubs, filters]);

  return (
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

      <TournamentFilters filters={filters} onChange={setFilters} />

      {view === 'calendar' ? (
        <WeekCalendar tournaments={filtered} clubs={clubs} />
      ) : (
        <TournamentList tournaments={filtered} clubs={clubs} />
      )}
    </>
  );
}
