'use client';

import { REGIONS, FORMAT_OPTIONS } from '@/lib/constants';

export interface Filters {
  region: string;
  format: string;
  fee: string;
  slots: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function TournamentFilters({ filters, onChange }: Props) {
  const activeCount =
    (filters.region ? 1 : 0) +
    (filters.format ? 1 : 0) +
    (filters.fee !== 'all' ? 1 : 0) +
    (filters.slots !== 'all' ? 1 : 0);

  const update = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  const reset = () =>
    onChange({ region: '', format: '', fee: 'all', slots: 'all' });

  const feeOptions = [
    { value: 'all', label: 'Alle' },
    { value: '0', label: 'Kostenlos' },
    { value: '30', label: 'Bis 30 €' },
    { value: '50', label: 'Bis 50 €' },
  ];

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

          {/* Fee chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Nenngeld
            </label>
            <div className="flex flex-wrap gap-2">
              {feeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ fee: opt.value })}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    filters.fee === opt.value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slots chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Freie Plätze
            </label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Alle' },
                { value: 'yes', label: 'Verfügbar' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ slots: opt.value })}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    filters.slots === opt.value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full py-2 text-sm text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Filter zurücksetzen
          </button>
        </div>
      </details>
    </div>
  );
}
