'use client';

import { useState, useMemo } from 'react';
import { Tournament, GolfClub } from '@/lib/types';
import { extractHoles } from '@/lib/tournament-utils';
import TournamentFilters, { Filters, DEFAULT_FILTERS } from '@/components/tournament-filters';
import WeekCalendar from '@/components/week-calendar';
import TournamentList from '@/components/tournament-list';

interface Props {
  tournaments: Tournament[];
  clubs: Record<string, GolfClub>;
}

export default function TurniereClient({ tournaments, clubs }: Props) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      const raw = t.raw_data || {};

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
        if (raw.free_slots !== null && raw.free_slots !== undefined && raw.free_slots <= 0)
          return false;
      }
      // HCP-relevant
      if (filters.hcp === 'yes' && !raw.hcp_relevant) return false;
      if (filters.hcp === 'no' && raw.hcp_relevant) return false;
      // Holes
      if (filters.holes !== 'all') {
        const holes = extractHoles(t.raw_data, t.description);
        if (holes !== parseInt(filters.holes)) return false;
      }
      // Gender
      if (filters.gender !== 'all') {
        const g = (t.gender || '').toLowerCase();
        if (filters.gender === 'herren' && !g.includes('herr') && !g.includes('männ')) return false;
        if (filters.gender === 'damen' && !g.includes('dam') && !g.includes('frauen')) return false;
        if (filters.gender === 'mixed' && !g.includes('herren und damen') && !g.includes('mixed') && !g.includes('alle')) return false;
      }
      // Visitors / Guests
      if (filters.visitors === 'yes') {
        const nenngeld = (raw.nenngeld_raw || '').toString().toLowerCase();
        const guestsAllowed = raw.guests_allowed ?? (nenngeld.includes('gäste') || nenngeld.includes('gast'));
        if (!guestsAllowed) return false;
      }
      // Age class
      if (filters.age !== 'all') {
        const ac = (t.age_class || '').toLowerCase();
        if (filters.age === 'jugend' && !ac.includes('jugend') && !ac.includes('junior')) return false;
        if (filters.age === 'senioren' && !ac.includes('senior') && !ac.includes('ü50') && !ac.includes('ü60')) return false;
        if (filters.age === 'keine' && ac && ac !== 'alle' && ac !== 'allgemein') return false;
      }
      // Sponsored / Prizes
      if (filters.sponsored === 'yes') {
        const prizes = raw.prizes;
        if (!prizes || !Array.isArray(prizes) || prizes.length === 0) return false;
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
