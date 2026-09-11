'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2, X } from 'lucide-react';
import { RANGE_OPTIONS, RangeKey, berlinDayString, formatDayDE } from '@/lib/analytics-range';

export interface RangeSelection {
  key: RangeKey;
  /** Only meaningful when key === 'custom'; YYYY-MM-DD Berlin days, inclusive. */
  from?: string;
  to?: string;
}

/** The query string both analytics endpoints expect. */
export function rangeQuery(selection: RangeSelection): string {
  const params = new URLSearchParams({ range: selection.key });
  if (selection.key === 'custom' && selection.from && selection.to) {
    params.set('from', selection.from);
    params.set('to', selection.to);
  }
  return params.toString();
}

/**
 * Preset buttons plus a custom from/to picker.
 *
 * The custom range is only submitted once both dates are set, so a half-typed
 * range never triggers a fetch — a native date input emits a value on every
 * keystroke, and "0002-01-01" is a valid date as far as it is concerned.
 */
export default function RangePicker({
  value,
  onChange,
  loading,
  resolved,
}: {
  value: RangeSelection;
  onChange: (next: RangeSelection) => void;
  loading: boolean;
  /** What the server actually used, echoed back so the label cannot drift. */
  resolved?: { from: string; to: string; days: number };
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? '');
  const popover = useRef<HTMLDivElement>(null);

  const today = berlinDayString(new Date());
  const isCustom = value.key === 'custom';

  // Click-outside and Escape both close the popover; without them the only way
  // out on a touch device is to pick a date.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (popover.current && !popover.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function applyCustom(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo) {
      onChange({ key: 'custom', from: nextFrom, to: nextTo });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-0.5">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange({ key: option.key })}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              value.key === option.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {option.label}
          </button>
        ))}

        <div className="relative" ref={popover}>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isCustom ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays size={14} />
            {isCustom && resolved
              ? `${formatDayDE(resolved.from)} – ${formatDayDE(resolved.to)}`
              : 'Zeitraum wählen'}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Eigener Zeitraum</span>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>

              <label className="block text-[11px] text-gray-500 mb-1">Von</label>
              <input
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => applyCustom(e.target.value, to)}
                className="w-full mb-2 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900"
              />

              <label className="block text-[11px] text-gray-500 mb-1">Bis</label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={today}
                onChange={(e) => applyCustom(from, e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900"
              />

              <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                Beide Tage zählen mit. Zeitzone: Europe/Berlin.
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && <Loader2 className="animate-spin text-gray-400" size={14} />}

      {resolved && (
        <span className="text-xs text-gray-400">
          {formatDayDE(resolved.from)} – {formatDayDE(resolved.to)} · {resolved.days}{' '}
          {resolved.days === 1 ? 'Tag' : 'Tage'}
        </span>
      )}
    </div>
  );
}
