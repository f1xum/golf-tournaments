import Link from 'next/link';
import { Tournament, GolfClub } from '@/lib/types';
import { formatDateFull, formatToLabel } from '@/lib/utils';
import { extractHoles, formatMeldeschluss, parseMeldeschluss } from '@/lib/tournament-utils';
import SaveTournamentButton from '@/components/save-tournament-button';

interface Props {
  tournament: Tournament;
  club?: GolfClub;
  userId: string | null;
  initialSaved: boolean;
}

export default function TournamentCard({ tournament: t, club, userId, initialSaved }: Props) {
  const raw = t.raw_data || {};
  const formatLabel = formatToLabel(t.format);
  const dateStr = formatDateFull(t.date_start);
  const endStr =
    t.date_end && t.date_end !== t.date_start
      ? ` – ${formatDateFull(t.date_end)}`
      : '';

  const holes = extractHoles(t.raw_data, t.description);
  const meldeschluss = formatMeldeschluss(t.raw_data);
  const meldeschlussDate = parseMeldeschluss(t.raw_data);

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const isNew = t.created_at
    ? nowMs - new Date(t.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
    : false;

  // Days until registration closes; only consider it "closing soon" if positive and ≤7.
  const daysUntilClose = meldeschlussDate
    ? Math.ceil((meldeschlussDate.getTime() - nowMs) / (24 * 60 * 60 * 1000))
    : null;
  const closingSoon = daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 7;

  const slotsLow =
    typeof raw.free_slots === 'number' && raw.free_slots > 0 && raw.free_slots <= 10;

  const slotsText =
    raw.max_participants
      ? raw.free_slots !== null && raw.free_slots !== undefined
        ? `${raw.free_slots}/${raw.max_participants} frei`
        : `${raw.max_participants} Plätze`
      : null;

  const prizeText =
    raw.prizes && raw.prizes.length > 0
      ? raw.prizes
          .map((p) => (p.count > 1 ? `${p.count}x ${p.category}` : p.category))
          .join(', ')
      : null;

  return (
    <Link
      href={`/turniere/${t.id}`}
      prefetch={false}
      className="block bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-semibold text-accent whitespace-nowrap">
          {dateStr}{endStr}
        </span>
        <div className="flex gap-1.5 ml-2 flex-shrink-0">
          {isNew && (
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded font-medium">
              Neu
            </span>
          )}
          {formatLabel && (
            <span className="text-xs px-2 py-0.5 bg-accent-light text-accent rounded font-medium">
              {formatLabel}
            </span>
          )}
          {holes && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
              {holes}L
            </span>
          )}
        </div>
      </div>

      {/* Name & club */}
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-base leading-snug mb-1">{t.name}</div>
        <SaveTournamentButton tournamentId={t.id} userId={userId} initialSaved={initialSaved} size="sm" />
      </div>
      <div className="text-sm text-gray-500 mb-2">
        {club?.name}{club?.city ? ` · ${club.city}` : ''}
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        {t.entry_fee != null && (
          <div>
            <span className="text-gray-400">Nenngeld</span>{' '}
            <span className="font-medium text-gray-900">{t.entry_fee} €</span>
          </div>
        )}
        {slotsText && (
          <div>
            <span className="text-gray-400">Plätze</span>{' '}
            <span className="font-medium text-gray-900">{slotsText}</span>
          </div>
        )}
        {raw.hcp_relevant && (
          <span className="font-medium text-accent">HCP-relevant</span>
        )}
      </div>

      {/* Urgency chips */}
      {(slotsLow || closingSoon) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slotsLow && (
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium dark:bg-[#2a2410] dark:border-[#5a4a18] dark:text-[#e8c84a]">
              Nur noch {raw.free_slots} {raw.free_slots === 1 ? 'Platz' : 'Plätze'}
            </span>
          )}
          {closingSoon && (
            <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-medium dark:bg-[#2a1515] dark:border-[#5a2020] dark:text-[#f87171]">
              {daysUntilClose === 0
                ? 'Schließt heute'
                : daysUntilClose === 1
                  ? 'Schließt morgen'
                  : `Schließt in ${daysUntilClose} Tagen`}
            </span>
          )}
        </div>
      )}

      {/* Meldeschluss */}
      {meldeschluss && !closingSoon && (
        <div className="mt-2 text-xs text-gray-400">
          Meldeschluss: {meldeschluss}
        </div>
      )}

      {/* Prizes */}
      {prizeText && (
        <div className="mt-2 px-3 py-2 bg-prize-bg border border-prize-border rounded-md text-sm dark:bg-[#2a2410] dark:border-[#5a4a18] dark:text-[#e8c84a]">
          <span className="mr-1">🏆</span>
          <span className="font-semibold">Preise:</span> {prizeText}
        </div>
      )}
    </Link>
  );
}
