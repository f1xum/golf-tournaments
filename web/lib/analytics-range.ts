/**
 * Date ranges for the admin dashboard, anchored to Europe/Berlin.
 *
 * Why a module of its own: the range is picked in the browser, resolved on the
 * server, and bucketed by the database, and all three have to agree on where a
 * day starts. Vercel runs in UTC, so "1. September" computed with plain
 * `new Date()` would begin at 02:00 Berlin time in summer and quietly move two
 * hours of traffic into the neighbouring month. Every boundary here is a Berlin
 * midnight, converted to the UTC instant that PostgreSQL compares against, and
 * migration 028 buckets days with `AT TIME ZONE 'Europe/Berlin'` to match.
 *
 * Ranges are half-open: [since, until). The end is exclusive, so "August" and
 * "September" never both claim a view recorded at exactly midnight.
 */

export const BERLIN = 'Europe/Berlin';

export type RangeKey =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'last_week'
  | 'mtd'
  | 'last_month'
  | 'custom';

export interface ResolvedRange {
  key: RangeKey;
  /** Inclusive start, as a UTC instant. */
  since: Date;
  /** Exclusive end, as a UTC instant. */
  until: Date;
  /** The equally long stretch immediately before `since`, for trend arrows. */
  prevSince: Date;
  prevUntil: Date;
  /** First and last Berlin calendar day in the range, as YYYY-MM-DD. */
  fromDay: string;
  toDay: string;
  /** Whole days covered, used for per-day averages. */
  days: number;
}

/** The picker's options, in the order they are shown. */
export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Heute' },
  { key: '7d', label: '7 Tage' },
  { key: '30d', label: '30 Tage' },
  { key: 'mtd', label: 'Dieser Monat' },
  { key: 'last_week', label: 'Letzte Woche' },
  { key: 'last_month', label: 'Letzter Monat' },
  { key: '90d', label: '90 Tage' },
];

const DAY_MS = 86400000;

/**
 * How far Europe/Berlin is ahead of UTC at a given instant, in milliseconds.
 * Reading the zone back out of Intl is the only way to get this right across
 * the March and October switches without shipping a timezone database.
 */
function berlinOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // Intl renders midnight as hour 24 in some engines; 24:00 is the same instant
  // as 00:00, so normalising it keeps the arithmetic below exact.
  const hour = get('hour') % 24;

  const asIfUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asIfUTC - at.getTime();
}

/** The Berlin calendar date at a given instant, as {y, m, d} with m 1-based. */
export function berlinDateParts(at: Date): { y: number; m: number; d: number } {
  const shifted = new Date(at.getTime() + berlinOffsetMs(at));
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

/**
 * The UTC instant at which the given Berlin calendar day begins.
 *
 * The offset depends on the instant we are looking for, which is what we are
 * computing — so guess, correct, and correct once more. The second pass only
 * matters on the two days a year the offset changes, and settles there.
 */
export function berlinMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - berlinOffsetMs(new Date(guess));
  result = guess - berlinOffsetMs(new Date(result));
  return new Date(result);
}

/** YYYY-MM-DD for the Berlin day an instant falls in. */
export function berlinDayString(at: Date): string {
  const { y, m, d } = berlinDateParts(at);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parses YYYY-MM-DD into Berlin midnight; null if it is not a real date. */
function parseDay(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const at = berlinMidnight(y, m, d);
  // Rejects 31 February and friends, which Date.UTC would happily roll over.
  const back = berlinDateParts(at);
  if (back.y !== y || back.m !== m || back.d !== d) return null;
  return at;
}

/**
 * Turn the picker's choice into concrete instants.
 *
 * `custom` needs `from` and `to` as YYYY-MM-DD Berlin days, both inclusive —
 * picking 1.–7. September covers all seven days, so `until` is the 8th at
 * midnight. Anything unparseable falls back to the last 7 days rather than
 * erroring, since a broken URL should not take the dashboard down.
 */
export function resolveRange(
  key: string | null,
  from: string | null,
  to: string | null,
  now: Date = new Date()
): ResolvedRange {
  const today = berlinDateParts(now);
  const startOfToday = berlinMidnight(today.y, today.m, today.d);
  const startOfTomorrow = berlinMidnight(today.y, today.m, today.d + 1);

  let since: Date;
  let until: Date;
  let resolved = (key ?? '7d') as RangeKey;

  switch (resolved) {
    case 'today':
      since = startOfToday;
      until = startOfTomorrow;
      break;

    case '30d':
    case '90d':
    case '7d': {
      // Rolling windows include today, so "7 Tage" is today plus the six
      // before it — not six days ending yesterday.
      const span = resolved === '90d' ? 90 : resolved === '30d' ? 30 : 7;
      since = berlinMidnight(today.y, today.m, today.d - (span - 1));
      until = startOfTomorrow;
      break;
    }

    case 'mtd':
      since = berlinMidnight(today.y, today.m, 1);
      until = startOfTomorrow;
      break;

    case 'last_month':
      since = berlinMidnight(today.y, today.m - 1, 1);
      until = berlinMidnight(today.y, today.m, 1);
      break;

    case 'last_week': {
      // Calendar week, Monday to Sunday — getUTCDay() is 0 for Sunday, so
      // Monday is six days back from it rather than one day forward.
      const weekday = new Date(startOfToday.getTime() + berlinOffsetMs(startOfToday)).getUTCDay();
      const daysSinceMonday = (weekday + 6) % 7;
      since = berlinMidnight(today.y, today.m, today.d - daysSinceMonday - 7);
      until = berlinMidnight(today.y, today.m, today.d - daysSinceMonday);
      break;
    }

    case 'custom': {
      const a = parseDay(from);
      const b = parseDay(to);
      if (!a || !b) {
        resolved = '7d';
        since = berlinMidnight(today.y, today.m, today.d - 6);
        until = startOfTomorrow;
        break;
      }
      // A backwards range is a slip in the picker, not a reason to fail.
      const lo = a <= b ? a : b;
      const hi = a <= b ? b : a;
      // Both ends name inclusive days, so the exclusive end is the next midnight.
      const hiParts = berlinDateParts(hi);
      since = lo;
      until = berlinMidnight(hiParts.y, hiParts.m, hiParts.d + 1);
      break;
    }

    default: {
      resolved = '7d';
      since = berlinMidnight(today.y, today.m, today.d - 6);
      until = startOfTomorrow;
    }
  }

  const span = until.getTime() - since.getTime();
  // Days, not milliseconds: the range containing the October clock change is
  // 73 hours long, and subtracting that many milliseconds would start the
  // comparison period an hour into the day before the one we want.
  const days = Math.max(1, Math.round(span / DAY_MS));
  const sinceParts = berlinDateParts(since);

  return {
    key: resolved,
    since,
    until,
    // The comparison period covers the same number of days and ends where this
    // one starts. That holds for every preset, month-to-date included, where
    // the fair comparison is the same many days of the month before.
    prevSince: berlinMidnight(sinceParts.y, sinceParts.m, sinceParts.d - days),
    prevUntil: since,
    fromDay: berlinDayString(since),
    // `until` is exclusive, so step back inside the range to name the last day.
    toDay: berlinDayString(new Date(until.getTime() - 1)),
    days,
  };
}

/** Human label for the resolved range, used in headings and CSV filenames. */
export function rangeLabel(range: ResolvedRange): string {
  const preset = RANGE_OPTIONS.find((o) => o.key === range.key);
  if (preset) return preset.label;
  return range.fromDay === range.toDay
    ? formatDayDE(range.fromDay)
    : `${formatDayDE(range.fromDay)} – ${formatDayDE(range.toDay)}`;
}

/** YYYY-MM-DD → DD.MM.YYYY, without going through Date. */
export function formatDayDE(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}
