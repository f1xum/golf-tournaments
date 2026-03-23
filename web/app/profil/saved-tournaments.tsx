import Link from 'next/link';
import { Tournament, GolfClub } from '@/lib/types';
import { formatDateFull, formatToLabel } from '@/lib/utils';
import { Bookmark, Calendar } from 'lucide-react';

interface Props {
  tournaments: Tournament[];
  clubs: Record<string, GolfClub>;
}

export default function SavedTournaments({ tournaments, clubs }: Props) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Bookmark size={18} className="text-accent" />
        <h2 className="text-lg font-bold">Gespeicherte Turniere</h2>
        {tournaments.length > 0 && (
          <span className="text-xs bg-accent-light text-accent px-2 py-0.5 rounded-full font-medium">
            {tournaments.length}
          </span>
        )}
      </div>

      {tournaments.length === 0 ? (
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
        <div className="space-y-3">
          {tournaments.map((t) => {
            const club = clubs[t.club_id || ''];
            const formatLabel = formatToLabel(t.format);
            return (
              <Link
                key={t.id}
                href={`/turniere/${t.id}`}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
              >
                {/* Date badge */}
                <div className="shrink-0 w-14 h-14 bg-accent-light rounded-lg flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-accent leading-none">
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
                  <div className="flex gap-1.5 mt-1.5">
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
  );
}
