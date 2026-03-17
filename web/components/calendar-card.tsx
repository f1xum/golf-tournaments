import { Tournament, GolfClub } from '@/lib/types';
import { formatToLabel } from '@/lib/utils';

interface Props {
  tournament: Tournament;
  club?: GolfClub;
}

export default function CalendarCard({ tournament: t, club }: Props) {
  const raw = t.raw_data || {};
  const formatLabel = formatToLabel(t.format);

  const Wrapper = t.source_url ? 'a' : 'div';
  const linkProps = t.source_url
    ? { href: t.source_url, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper
      {...linkProps}
      className="block bg-white border border-gray-200 rounded-md p-2.5 hover:shadow-sm transition-shadow cursor-pointer"
    >
      <div className="font-semibold text-sm leading-snug mb-0.5">{t.name}</div>
      <div className="text-xs text-gray-500 mb-1.5">{club?.name || ''}</div>
      <div className="flex flex-wrap gap-1 text-[11px]">
        {formatLabel && (
          <span className="px-1.5 py-0.5 bg-accent-light text-accent rounded font-medium">
            {formatLabel}
          </span>
        )}
        {t.entry_fee != null && (
          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
            {t.entry_fee} €
          </span>
        )}
        {raw.prizes && raw.prizes.length > 0 && (
          <span className="px-1.5 py-0.5 bg-prize-bg text-prize-text rounded">
            🏆 Preise
          </span>
        )}
        {raw.free_slots != null && raw.max_participants != null && (
          <span className="px-1.5 py-0.5 bg-green-50 text-accent rounded">
            {raw.free_slots}/{raw.max_participants}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
