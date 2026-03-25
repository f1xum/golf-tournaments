'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { GolfClub } from '@/lib/types';
import { distanceKm } from '@/lib/utils';
import { REGIONS } from '@/lib/constants';
import { MapPin, ChevronRight, Locate } from 'lucide-react';

interface Props {
  clubs: GolfClub[];
}

export default function ClubsClient({ clubs }: Props) {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setSortByDistance(true);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = clubs.filter((c) => {
      if (region && c.region !== region) return false;
      if (q) {
        const haystack = `${c.name} ${c.city || ''} ${c.address || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sortByDistance && userPos) {
      result = [...result].sort((a, b) => {
        const distA = a.latitude && a.longitude
          ? distanceKm(userPos[0], userPos[1], a.latitude, a.longitude)
          : Infinity;
        const distB = b.latitude && b.longitude
          ? distanceKm(userPos[0], userPos[1], b.latitude, b.longitude)
          : Infinity;
        return distA - distB;
      });
    }

    return result;
  }, [clubs, search, region, sortByDistance, userPos]);

  const getDistance = (club: GolfClub) => {
    if (!userPos || !club.latitude || !club.longitude) return null;
    return distanceKm(userPos[0], userPos[1], club.latitude, club.longitude);
  };

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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

      {/* Location / sort bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{filtered.length} Clubs</p>
        <button
          onClick={() => {
            if (userPos) {
              setSortByDistance(!sortByDistance);
            } else {
              handleLocate();
            }
          }}
          disabled={locating}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            sortByDistance
              ? 'bg-blue-50 text-blue-600 border border-blue-200'
              : 'text-gray-500 border border-gray-200 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          <Locate size={14} className={locating ? 'animate-pulse' : ''} />
          {locating ? 'Suche...' : sortByDistance ? 'In der Nähe' : 'Nächste zuerst'}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((club) => {
          const dist = sortByDistance ? getDistance(club) : null;
          return (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base mb-1">{club.name}</div>
                <div className="flex items-center gap-2">
                  {(club.city || club.region) && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={14} className="shrink-0" />
                      <span className="truncate">
                        {[club.city, club.region].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {dist != null && (
                    <span className="text-xs text-blue-500 font-medium shrink-0">
                      {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
          );
        })}
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
