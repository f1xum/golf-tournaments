'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { GolfClub } from '@/lib/types';
import { REGIONS } from '@/lib/constants';
import { MapPin, ChevronRight } from 'lucide-react';

interface Props {
  clubs: GolfClub[];
}

export default function ClubsClient({ clubs }: Props) {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clubs.filter((c) => {
      if (region && c.region !== region) return false;
      if (q) {
        const haystack = `${c.name} ${c.city || ''} ${c.address || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [clubs, search, region]);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Club oder Stadt suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        />
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Alle Regionen</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-4">{filtered.length} Clubs</p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((club) => (
          <Link
            key={club.id}
            href={`/clubs/${club.id}`}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base mb-1">{club.name}</div>
              {(club.city || club.region) && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin size={14} className="shrink-0" />
                  <span className="truncate">
                    {[club.city, club.region].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
            <ChevronRight size={16} className="shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Clubs gefunden</h3>
          <p>Versuche einen anderen Suchbegriff oder eine andere Region.</p>
        </div>
      )}
    </>
  );
}
