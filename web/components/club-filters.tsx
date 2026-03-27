'use client';

import { ChevronDown } from 'lucide-react';
import { REGIONS } from '@/lib/constants';

export interface ClubFilters {
  region: string;
  favorites: string;      // 'all' | 'yes'
  tournaments: string;    // 'all' | 'yes'
  holes: string;          // 'all' | '9' | '18'
  distance: string;       // 'all' | '25' | '50' | '100'
}

export const DEFAULT_CLUB_FILTERS: ClubFilters = {
  region: '',
  favorites: 'all',
  tournaments: 'all',
  holes: 'all',
  distance: 'all',
};

interface Props {
  filters: ClubFilters;
  onChange: (filters: ClubFilters) => void;
  hasFavorites?: boolean;
  hasLocation?: boolean;
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            value === opt.value
              ? 'bg-accent text-white border-accent'
              : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ClubFiltersPanel({ filters, onChange, hasFavorites, hasLocation }: Props) {
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'region') return v !== '';
    return v !== 'all';
  }).length;

  const update = (partial: Partial<ClubFilters>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="mb-4">
      <details className="group bg-white border border-gray-200 rounded-lg">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium select-none list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <ChevronDown size={16} className="text-gray-400 transition-transform group-open:rotate-180" />
            <span>Filter</span>
          </div>
          {activeCount > 0 && (
            <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </summary>

        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* Region */}
          <div className="pt-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Region
            </label>
            <select
              value={filters.region}
              onChange={(e) => update({ region: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50"
            >
              <option value="">Alle Regionen</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Favorites */}
          {hasFavorites && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Favoriten
              </label>
              <ChipGroup
                options={[
                  { value: 'all', label: 'Alle Clubs' },
                  { value: 'yes', label: 'Nur Favoriten' },
                ]}
                value={filters.favorites}
                onChange={(v) => update({ favorites: v })}
              />
            </div>
          )}

          {/* Tournaments */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Turniere
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'yes', label: 'Mit Turnieren' },
              ]}
              value={filters.tournaments}
              onChange={(v) => update({ tournaments: v })}
            />
          </div>

          {/* Holes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Platz
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: '9', label: '9 Löcher' },
                { value: '18', label: '18 Löcher' },
              ]}
              value={filters.holes}
              onChange={(v) => update({ holes: v })}
            />
          </div>

          {/* Distance */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Umkreis
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: '25', label: '25 km' },
                { value: '50', label: '50 km' },
                { value: '100', label: '100 km' },
              ]}
              value={filters.distance}
              onChange={(v) => update({ distance: v })}
            />
          </div>

          <button
            onClick={() => onChange(DEFAULT_CLUB_FILTERS)}
            className="w-full py-2 text-sm text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Filter zurücksetzen
          </button>
        </div>
      </details>
    </div>
  );
}
