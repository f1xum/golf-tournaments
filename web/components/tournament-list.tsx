'use client';

import { useState } from 'react';
import { Tournament, GolfClub } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/constants';
import TournamentCard from './tournament-card';

interface Props {
  tournaments: Tournament[];
  clubs: Record<string, GolfClub>;
}

export default function TournamentList({ tournaments, clubs }: Props) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [sortBy, setSortBy] = useState('date_asc');

  const sorted = [...tournaments].sort((a, b) => {
    if (sortBy === 'date_asc') return a.date_start.localeCompare(b.date_start);
    if (sortBy === 'date_desc') return b.date_start.localeCompare(a.date_start);
    if (sortBy === 'fee_asc') return (a.entry_fee || 0) - (b.entry_fee || 0);
    return 0;
  });

  const visible = sorted.slice(0, displayCount);
  const hasMore = sorted.length > displayCount;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between py-2 mb-2">
        <span className="text-sm text-gray-500">
          {sorted.length} Turnier{sorted.length !== 1 ? 'e' : ''}
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-sm px-2 py-1 border border-gray-200 rounded bg-white text-gray-500"
        >
          <option value="date_asc">Datum (aufsteigend)</option>
          <option value="date_desc">Datum (absteigend)</option>
          <option value="fee_asc">Nenngeld (aufsteigend)</option>
        </select>
      </div>

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Turniere gefunden</h3>
          <p>Versuche andere Filter oder einen anderen Zeitraum.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((t) => (
            <TournamentCard key={t.id} tournament={t} club={clubs[t.club_id || '']} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center py-5">
          <button
            onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
            className="px-8 py-3 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Mehr laden ({sorted.length - displayCount} weitere)
          </button>
        </div>
      )}
    </div>
  );
}
