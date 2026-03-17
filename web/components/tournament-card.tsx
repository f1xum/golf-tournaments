import { Tournament, GolfClub } from '@/lib/types';
import { formatDateFull, formatToLabel } from '@/lib/utils';

interface Props {
  tournament: Tournament;
  club?: GolfClub;
}

export default function TournamentCard({ tournament: t, club }: Props) {
  const raw = t.raw_data || {};
  const formatLabel = formatToLabel(t.format);
  const dateStr = formatDateFull(t.date_start);
  const endStr =
    t.date_end && t.date_end !== t.date_start
      ? ` – ${formatDateFull(t.date_end)}`
      : '';

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

  const Wrapper = t.source_url ? 'a' : 'div';
  const linkProps = t.source_url
    ? { href: t.source_url, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper
      {...linkProps}
      className="block bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-semibold text-accent whitespace-nowrap">
          {dateStr}{endStr}
        </span>
        {formatLabel && (
          <span className="text-xs px-2 py-0.5 bg-accent-light text-accent rounded font-medium ml-2">
            {formatLabel}
          </span>
        )}
      </div>

      {/* Name & club */}
      <div className="font-semibold text-base leading-snug mb-1">{t.name}</div>
      <div className="text-sm text-gray-500 mb-2">
        {club?.name}{club?.city ? ` · ${club.city}` : ''}
      </div>

      {/* Details */}
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
          <span className="font-medium text-gray-900">HCP-relevant</span>
        )}
      </div>

      {/* Prizes */}
      {prizeText && (
        <div className="mt-2 px-3 py-2 bg-prize-bg border border-prize-border rounded-md text-sm">
          <span className="mr-1">🏆</span>
          <span className="font-semibold">Preise:</span> {prizeText}
        </div>
      )}
    </Wrapper>
  );
}
