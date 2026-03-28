'use client';

import { ChevronDown } from 'lucide-react';
import { BUNDESLAENDER, FORMAT_OPTIONS } from '@/lib/constants';

export interface Filters {
  region: string;
  format: string;
  fee: string;
  slots: string;
  hcp: string;
  holes: string;
  gender: string;
  visitors: string;
  age: string;
  sponsored: string;
  club: string;
  distance: string;       // 'all' | '25' | '50' | '100'
  distanceFrom: string;   // 'location' | 'homeclub'
  favoriteClubs: string;  // 'all' | 'yes'
}

export const DEFAULT_FILTERS: Filters = {
  region: 'Bayern',
  format: '',
  fee: 'all',
  slots: 'all',
  hcp: 'all',
  holes: 'all',
  gender: 'all',
  visitors: 'all',
  age: 'all',
  sponsored: 'all',
  club: '',
  distance: 'all',
  distanceFrom: 'location',
  favoriteClubs: 'all',
};

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  hasHomeClub?: boolean;
  hasFavoriteClubs?: boolean;
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

export default function TournamentFilters({ filters, onChange, hasHomeClub, hasFavoriteClubs }: Props) {
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'region' || k === 'format' || k === 'club') return v !== '';
    if (k === 'distanceFrom') return false;
    return v !== 'all';
  }).length;


  const update = (partial: Partial<Filters>) =>
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
          {/* Bundesland */}
          <div className="pt-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Bundesland
            </label>
            <select
              value={filters.region}
              onChange={(e) => update({ region: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50"
            >
              <option value="">Alle Bundesländer</option>
              {BUNDESLAENDER.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Favorite clubs */}
          {hasFavoriteClubs && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Favoriten-Clubs
              </label>
              <ChipGroup
                options={[
                  { value: 'all', label: 'Alle Clubs' },
                  { value: 'yes', label: 'Nur Favoriten' },
                ]}
                value={filters.favoriteClubs}
                onChange={(v) => update({ favoriteClubs: v })}
              />
            </div>
          )}

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
            {filters.distance !== 'all' && hasHomeClub && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => update({ distanceFrom: 'location' })}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    filters.distanceFrom === 'location'
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  Mein Standort
                </button>
                <button
                  onClick={() => update({ distanceFrom: 'homeclub' })}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    filters.distanceFrom === 'homeclub'
                      ? 'bg-accent-light text-accent border-accent/20'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  Heimatclub
                </button>
              </div>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Spielform
            </label>
            <select
              value={filters.format}
              onChange={(e) => update({ format: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50"
            >
              <option value="">Alle Formate</option>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Fee */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Nenngeld
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: '0', label: 'Kostenlos' },
                { value: '30', label: 'Bis 30 €' },
                { value: '50', label: 'Bis 50 €' },
              ]}
              value={filters.fee}
              onChange={(v) => update({ fee: v })}
            />
          </div>

          {/* Slots */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Freie Plätze
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'yes', label: 'Verfügbar' },
              ]}
              value={filters.slots}
              onChange={(v) => update({ slots: v })}
            />
          </div>

          {/* HCP-relevant */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              HCP-relevant
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'yes', label: 'Nur HCP-relevant' },
                { value: 'no', label: 'Nicht HCP-relevant' },
              ]}
              value={filters.hcp}
              onChange={(v) => update({ hcp: v })}
            />
          </div>

          {/* Holes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Löcher
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

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Geschlecht
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'herren', label: 'Herren' },
                { value: 'damen', label: 'Damen' },
                { value: 'mixed', label: 'Mixed' },
              ]}
              value={filters.gender}
              onChange={(v) => update({ gender: v })}
            />
          </div>

          {/* Visitors */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Gäste erlaubt
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'yes', label: 'Gäste willkommen' },
              ]}
              value={filters.visitors}
              onChange={(v) => update({ visitors: v })}
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Altersklasse
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'jugend', label: 'Jugend' },
                { value: 'senioren', label: 'Senioren' },
                { value: 'keine', label: 'Keine Einschränkung' },
              ]}
              value={filters.age}
              onChange={(v) => update({ age: v })}
            />
          </div>

          {/* Sponsored / Prizes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Preise / Sponsoring
            </label>
            <ChipGroup
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'yes', label: 'Mit Preisen' },
              ]}
              value={filters.sponsored}
              onChange={(v) => update({ sponsored: v })}
            />
          </div>

          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="w-full py-2 text-sm text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Filter zurücksetzen
          </button>
        </div>
      </details>
    </div>
  );
}
