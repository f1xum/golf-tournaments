/**
 * Checks for the Berlin date maths in ./analytics-range.ts.
 *
 * Run with: node lib/analytics-range.test.mts
 *
 * Worth having as a file rather than a one-off: the DST cases are the ones
 * that break, they break twice a year, and they break quietly — a range that
 * is an hour off still renders a perfectly plausible dashboard. Two real bugs
 * turned up here before this ever ran against the database: a previous period
 * that drifted a day across the October clock change, and a reversed custom
 * range that silently lost its first day.
 */
import { resolveRange, berlinMidnight, berlinDayString } from './analytics-range.ts';

let fails = 0;
const eq = (name, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got}${ok ? '' : `  (want ${want})`}`);
};

// Berlin midnight → UTC instant. Summer = UTC+2, winter = UTC+1.
eq('1 Jul midnight (CEST)', berlinMidnight(2026, 7, 1).toISOString(), '2026-06-30T22:00:00.000Z');
eq('1 Jan midnight (CET)',  berlinMidnight(2026, 1, 1).toISOString(), '2025-12-31T23:00:00.000Z');
// DST transitions: 29 Mar 2026 (spring forward), 25 Oct 2026 (fall back)
eq('29 Mar midnight (spring fwd)', berlinMidnight(2026, 3, 29).toISOString(), '2026-03-28T23:00:00.000Z');
eq('30 Mar midnight (after fwd)',  berlinMidnight(2026, 3, 30).toISOString(), '2026-03-29T22:00:00.000Z');
eq('25 Oct midnight (fall back)',  berlinMidnight(2026, 10, 25).toISOString(), '2026-10-24T22:00:00.000Z');
eq('26 Oct midnight (after back)', berlinMidnight(2026, 10, 26).toISOString(), '2026-10-25T23:00:00.000Z');
// Month rollover
eq('month rollover d+1', berlinMidnight(2026, 1, 32).toISOString(), berlinMidnight(2026, 2, 1).toISOString());
eq('month rollback m-1', berlinMidnight(2026, 0, 1).toISOString(), berlinMidnight(2025, 12, 1).toISOString());

// Ranges, anchored to Fri 11 Sep 2026, 09:30 Berlin (07:30Z)
const now = new Date('2026-09-11T07:30:00Z');
const show = (k, from = null, to = null) => {
  const r = resolveRange(k, from, to, now);
  return `${r.fromDay}..${r.toDay} d=${r.days} prev=${berlinDayString(r.prevSince)}..${berlinDayString(new Date(r.prevUntil.getTime() - 1))}`;
};
eq('today',      show('today'),      '2026-09-11..2026-09-11 d=1 prev=2026-09-10..2026-09-10');
eq('7d',         show('7d'),         '2026-09-05..2026-09-11 d=7 prev=2026-08-29..2026-09-04');
eq('30d',        show('30d'),        '2026-08-13..2026-09-11 d=30 prev=2026-07-14..2026-08-12');
eq('mtd',        show('mtd'),        '2026-09-01..2026-09-11 d=11 prev=2026-08-21..2026-08-31');
eq('last_month', show('last_month'), '2026-08-01..2026-08-31 d=31 prev=2026-07-01..2026-07-31');
// 11 Sep 2026 is a Friday → last full week is Mon 31 Aug .. Sun 6 Sep
eq('last_week',  show('last_week'),  '2026-08-31..2026-09-06 d=7 prev=2026-08-24..2026-08-30');
eq('custom',     show('custom', '2026-08-01', '2026-08-14'), '2026-08-01..2026-08-14 d=14 prev=2026-07-18..2026-07-31');
eq('custom single day', show('custom', '2026-08-05', '2026-08-05'), '2026-08-05..2026-08-05 d=1 prev=2026-08-04..2026-08-04');
// Custom range spanning the October DST change keeps whole days
eq('custom across DST', show('custom', '2026-10-24', '2026-10-26'), '2026-10-24..2026-10-26 d=3 prev=2026-10-21..2026-10-23');

// Bad input must fall back, never throw
eq('invalid key',   resolveRange('garbage', null, null, now).key, '7d');
eq('bad custom',    resolveRange('custom', '2026-02-31', '2026-03-01', now).key, '7d');
eq('missing dates', resolveRange('custom', null, null, now).key, '7d');
eq('reversed custom', show('custom', '2026-08-14', '2026-08-01'), '2026-08-01..2026-08-14 d=14 prev=2026-07-18..2026-07-31');

// Boundaries must be exclusive: last_month.until === mtd-of-that-month start
const aug = resolveRange('last_month', null, null, now);
eq('aug until = 1 Sep midnight', aug.until.toISOString(), berlinMidnight(2026, 9, 1).toISOString());

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
