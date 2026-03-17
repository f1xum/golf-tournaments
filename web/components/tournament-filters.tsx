'use client';

import { REGIONS, FORMAT_OPTIONS } from '@/lib/constants';

export interface Filters {
  region: string;
  format: string;
  fee: string;
  slots: string;
  hcp: string;
  holes: string;
}

export const DEFAULT_FILTERS: Filters = {
  region: '',
  format: '',
  fee: 'all',
  slots: 'all',
  hcp: 'all',
  holes: 'all',
};

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
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

export default function TournamentFilters({ filters, onChange }: Props) {
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'region' || k === 'format') return v !== '';
    return v !== 'all';
  }).length;

  const update = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="mb-4">
      <details className="group bg-white border border-gray-200 rounded-lg">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium select-none">
          <span>Filter</span>
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
