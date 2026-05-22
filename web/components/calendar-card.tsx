import Link from 'next/link';
import { Tournament, GolfClub } from '@/lib/types';
import { formatToLabel } from '@/lib/utils';
import { extractHoles } from '@/lib/tournament-utils';

interface Props {
  tournament: Tournament;
  club?: GolfClub;
}

export default function CalendarCard({ tournament: t, club }: Props) {
  const raw = t.raw_data || {};
  const formatLabel = formatToLabel(t.format);
  const holes = extractHoles(t.raw_data, t.description);

  return (
    <Link
      href={`/turniere/${t.id}`}
      prefetch={false}
      className="block bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333] rounded-md p-2.5 hover:shadow-sm transition-shadow cursor-pointer"
    >
      <div className="font-semibold text-sm leading-snug mb-0.5 dark:text-[#f5f5f5]">{t.name}</div>
      <div className="text-xs text-gray-500 dark:text-[#a0a0a0] mb-1.5">{club?.name || ''}</div>
      <div className="flex flex-wrap gap-1 text-[11px]">
        {formatLabel && (
          <span className="px-1.5 py-0.5 bg-accent-light text-accent rounded font-medium">
            {formatLabel}
          </span>
        )}
        {holes && (
          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-[#b8b8b8] rounded font-medium">
            {holes}L
          </span>
        )}
        {t.entry_fee != null && (
          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-[#d4d4d4] rounded">
            {t.entry_fee} €
          </span>
        )}
        {raw.hcp_relevant && (
          <span className="px-1.5 py-0.5 bg-accent-light text-accent rounded font-medium">
            HCP
          </span>
        )}
        {raw.prizes && raw.prizes.length > 0 && (
          <span className="px-1.5 py-0.5 bg-prize-bg text-prize-text rounded">
            🏆
          </span>
        )}
        {raw.free_slots != null && raw.max_participants != null && (
          <span className="px-1.5 py-0.5 bg-green-50 dark:bg-[#152a1a] text-accent rounded">
            {raw.free_slots}/{raw.max_participants}
          </span>
        )}
      </div>
    </Link>
  );
}
