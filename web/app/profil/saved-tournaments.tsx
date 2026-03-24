'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tournament, GolfClub } from '@/lib/types';
import { formatDateFull, formatToLabel } from '@/lib/utils';
import { Bookmark, Calendar, ChevronDown } from 'lucide-react';

interface Props {
  upcoming: Tournament[];
  past: Tournament[];
  clubs: Record<string, GolfClub>;
}

export default function SavedTournaments({ upcoming, past, clubs }: Props) {
  const total = upcoming.length + past.length;

  return (
    <div id="saved-tournaments" className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Bookmark size={18} className="text-accent" />
        <h2 className="text-lg font-bold">Gespeicherte Turniere</h2>
        {total > 0 && (
          <span className="text-xs bg-accent-light text-accent px-2 py-0.5 rounded-full font-medium">
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">
            Noch keine Turniere gespeichert.
          </p>
          <Link
            href="/turniere"
            className="inline-block mt-3 text-sm text-accent hover:underline font-medium"
          >
            Turniere entdecken →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <ToggleSection
            label="Anstehende Turniere"
            count={upcoming.length}
            defaultOpen
            tournaments={upcoming}
            clubs={clubs}
            emptyText="Keine anstehenden Turniere gespeichert."
          />
          <ToggleSection
            label="Vergangene Turniere"
            count={past.length}
            defaultOpen={false}
            tournaments={past}
            clubs={clubs}
            emptyText="Keine vergangenen Turniere."
          />
        </div>
      )}
    </div>
  );
}

function ToggleSection({
  label,
  count,
  defaultOpen,
  tournaments,
  clubs,
  emptyText,
}: {
  label: string;
  count: number;
  defaultOpen: boolean;
  tournaments: Tournament[];
  clubs: Record<string, GolfClub>;
  emptyText: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          {count > 0 && (
            <span className="text-xs bg-accent-light text-accent px-1.5 py-0.5 rounded-full font-medium">
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-gray-200">
          {tournaments.length === 0 ? (
            <p className="text-sm text-gray-400 px-4 py-6 text-center">{emptyText}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {tournaments.map((t) => {
                const club = clubs[t.club_id || ''];
                const formatLabel = formatToLabel(t.format);
                return (
                  <Link
                    key={t.id}
                    href={`/turniere/${t.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    {/* Date badge */}
                    <div className="shrink-0 w-12 h-12 bg-accent-light rounded-lg flex flex-col items-center justify-center">
                      <span className="text-base font-bold text-accent leading-none">
                        {new Date(t.date_start + 'T00:00:00').getDate()}
                      </span>
                      <span className="text-[10px] text-accent font-medium uppercase">
                        {new Date(t.date_start + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm leading-snug truncate">{t.name}</div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">
                        {club?.name}{club?.city ? ` · ${club.city}` : ''}
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {formatLabel && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-accent-light text-accent rounded font-medium">
                            {formatLabel}
                          </span>
                        )}
                        {t.entry_fee != null && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {t.entry_fee} €
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
