'use client';

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

/* Audience segments. Defined in globals.css so dark mode gets its own
   validated steps instead of reusing the light ones — see the note there
   before changing any of them. */
export const MEMBER_COLOR = 'var(--viz-member)';
export const VISITOR_COLOR = 'var(--viz-visitor)';
export const UNTRACKED_COLOR = 'var(--viz-untracked)';

/* ─── Numbers ─── */

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** "vor 3 Tagen" / "heute" — how a last-seen column is actually read. */
export function formatRelative(iso: string | null): string {
  if (!iso) return 'nie';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 14) return 'vor 1 Woche';
  if (days < 60) return `vor ${Math.floor(days / 7)} Wochen`;
  return `vor ${Math.floor(days / 30)} Monaten`;
}

/** DD.MM. for chart axes, from a YYYY-MM-DD day. */
export function formatDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}.${m}.`;
}

export function formatWeekday(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'short' });
}

/* ─── Stat tile ─── */

/**
 * One headline number, optionally against the same-length period before it.
 *
 * `delta` is deliberately absent rather than zero when there is nothing to
 * compare to — an arrow pointing flat at a period that was never measured
 * claims more than the data supports.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  previous,
  hint,
  suffix,
  invertDelta = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  previous?: number;
  hint?: string;
  suffix?: string;
  /** For metrics where up is bad, e.g. dormant accounts. */
  invertDelta?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gray-400" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">
          {formatNumber(value)}
          {suffix && <span className="text-base font-semibold text-gray-500 ml-0.5">{suffix}</span>}
        </span>
        {previous !== undefined && <Delta current={value} previous={previous} invert={invertDelta} />}
      </div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

/**
 * Change against the previous period. Growth from zero has no percentage, so
 * it is shown as "neu" rather than as an infinite increase.
 */
function Delta({ current, previous, invert }: { current: number; previous: number; invert: boolean }) {
  if (previous === 0 && current === 0) return null;

  const good = invert ? current < previous : current > previous;
  const flat = current === previous;
  const tone = flat ? 'text-gray-400' : good ? 'text-emerald-600' : 'text-red-500';
  const Icon = flat ? ArrowRight : current > previous ? ArrowUpRight : ArrowDownRight;

  const text =
    previous === 0
      ? 'neu'
      : `${current > previous ? '+' : ''}${formatNumber(((current - previous) / previous) * 100, 0)} %`;

  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${tone}`} title={`Vorperiode: ${formatNumber(previous)}`}>
      <Icon size={12} />
      {text}
    </span>
  );
}

/* ─── Legend ─── */

export function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/* ─── Inline bar ─── */

/**
 * A row's value as a number plus a split bar: anonymous share first, signed-in
 * share second. The 1px gap keeps the two readable where one is tiny.
 */
export function ViewBar({ value, memberValue, max }: { value: number; memberValue: number; max: number }) {
  const total = (value / Math.max(max, 1)) * 100;
  const memberShare = value > 0 ? memberValue / value : 0;
  return (
    <div
      className="flex items-center gap-2 justify-end"
      title={`${formatNumber(value)} Aufrufe · davon ${formatNumber(memberValue)} eingeloggt`}
    >
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:flex gap-[1px]">
        <div className="h-full" style={{ width: `${total * (1 - memberShare)}%`, backgroundColor: VISITOR_COLOR }} />
        <div className="h-full" style={{ width: `${total * memberShare}%`, backgroundColor: MEMBER_COLOR }} />
      </div>
      <span className="font-medium text-gray-900 tabular-nums">{formatNumber(value)}</span>
    </div>
  );
}

/* ─── Section heading ─── */

export function SectionTitle({
  icon,
  children,
  right,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-gray-700 mb-3">
      {icon}
      {children}
      {right && <span className="ml-auto flex items-center gap-3 text-xs font-normal text-gray-500">{right}</span>}
    </h2>
  );
}

/**
 * X-axis for the day charts.
 *
 * One label per bar does not fit — at 30 days each slot is about 8px and
 * "13.08." needs 32, so the labels truncated to "13…". Instead pick a handful
 * of evenly spaced days and space them across the axis, which stays readable
 * from 7 days to 90 and from a phone to a wide screen. `max` is lower for the
 * narrow side-by-side charts than for a full-width one.
 */
export function DayAxis({ days, max = 6 }: { days: string[]; max?: number }) {
  if (days.length === 0) return null;

  const count = Math.min(max, days.length);
  const picked =
    count === 1
      ? [days[0]]
      : Array.from({ length: count }, (_, i) =>
          days[Math.round((i * (days.length - 1)) / (count - 1))]
        );

  return (
    <div className="flex justify-between mt-2 text-[10px] text-gray-400 tabular-nums">
      {picked.map((day, i) => (
        <span key={`${day}-${i}`}>{formatDay(day)}</span>
      ))}
    </div>
  );
}

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-6 text-center text-gray-400 text-sm">
        {children}
      </td>
    </tr>
  );
}
