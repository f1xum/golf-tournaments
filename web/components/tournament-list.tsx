'use client';

import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Tournament, GolfClub } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/constants';
import { ScoringProfile, scoreTournaments } from '@/lib/recommendations';
import TournamentCard from './tournament-card';
import { EmptyState } from './empty-state';

interface Props {
  tournaments: Tournament[];
  clubs: Record<string, GolfClub>;
  savedTournamentIds: Set<string>;
  userId: string | null;
  scoringProfile?: ScoringProfile | null;
  savedClubIds?: Set<string>;
}

export default function TournamentList({
  tournaments,
  clubs,
  savedTournamentIds,
  userId,
  scoringProfile,
  savedClubIds,
}: Props) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [sortBy, setSortBy] = useState('date_asc');

  // Match-score sort is only available to logged-in users with a home club set.
  const canScore = !!(scoringProfile?.home_club_id);

  const sorted = useMemo(() => {
    if (sortBy === 'score' && canScore && scoringProfile) {
      // scoreTournaments returns a sorted ScoredTournament[]
      return scoreTournaments(tournaments, scoringProfile, clubs, savedClubIds ?? new Set());
    }
    return [...tournaments].sort((a, b) => {
      if (sortBy === 'date_asc') return a.date_start.localeCompare(b.date_start);
      if (sortBy === 'date_desc') return b.date_start.localeCompare(a.date_start);
      if (sortBy === 'fee_asc') return (a.entry_fee || 0) - (b.entry_fee || 0);
      return 0;
    });
  }, [tournaments, sortBy, canScore, scoringProfile, clubs, savedClubIds]);

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
          {canScore && <option value="score">Beste Treffer</option>}
          <option value="date_asc">Datum (aufsteigend)</option>
          <option value="date_desc">Datum (absteigend)</option>
          <option value="fee_asc">Nenngeld (aufsteigend)</option>
        </select>
      </div>

      {/* Cards */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Keine Turniere gefunden"
          description="Versuche, einen Filter zu entfernen oder einen anderen Zeitraum zu wählen."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((t) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              club={clubs[t.club_id || '']}
              userId={userId}
              initialSaved={savedTournamentIds.has(t.id)}
            />
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
