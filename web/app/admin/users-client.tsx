'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  LogIn,
  Repeat,
  Search,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { RangeSelection, rangeQuery } from './range-picker';
import {
  DayAxis,
  EmptyRow,
  LegendKey,
  MEMBER_COLOR,
  SectionTitle,
  StatCard,
  VISITOR_COLOR,
  formatDate,
  formatDay,
  formatNumber,
  formatRelative,
  formatWeekday,
} from './shared';

/* ─── Shapes returned by /api/admin/analytics/users ─── */

interface Summary {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  newActiveUsers: number;
  returningUsers: number;
  repeatUsers: number;
  dormantUsers: number;
  visits: number;
  memberViews: number;
  activeDays: number;
  trackingSince: string | null;
}

interface DailyRow {
  day: string;
  signups: number;
  total_users: number;
  active_users: number;
  new_active_users: number;
  returning_active_users: number;
  visits: number;
  member_views: number;
}

interface UserRow {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  home_club: string | null;
  handicap: number | null;
  role: string | null;
  signed_up_at: string;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  views_in_range: number;
  active_days_in_range: number;
  visits_in_range: number;
  total_views: number;
  total_active_days: number;
  saved_tournaments: number;
  saved_clubs: number;
  is_new: boolean;
  is_active: boolean;
}

interface CohortRow {
  cohort_week: string;
  cohort_size: number;
  week_offset: number;
  active_users: number;
}

interface UsersData {
  range: { key: string; from: string; to: string; days: number };
  summary: Summary;
  previous: Partial<Summary>;
  daily: DailyRow[];
  users: UserRow[];
  cohorts: CohortRow[];
  error?: string;
  detail?: string;
}

export default function UsersDashboard({
  selection,
  onRangeMeta,
}: {
  selection: RangeSelection;
  onRangeMeta: (meta: { from: string; to: string; days: number }) => void;
}) {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const query = rangeQuery(selection);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/analytics/users?${query}`)
      .then((r) => r.json())
      .then((d: UsersData) => {
        if (cancelled) return;
        setData(d);
        if (d.range) onRangeMeta(d.range);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // onRangeMeta is a stable callback from the shell; re-running on it would
    // refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }
  if (!data) return null;

  // Migration 028 not applied yet: say so instead of rendering confident zeroes.
  if (data.error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-sm font-medium text-gray-900 mb-1">Nutzer-Auswertung nicht verfügbar</p>
        <p className="text-sm text-gray-500">
          Die Datenbank-Funktionen fehlen. Migration{' '}
          <code className="font-mono text-xs">028_user_analytics.sql</code> im Supabase SQL Editor
          ausführen.
        </p>
        {data.detail && <p className="mt-2 font-mono text-[11px] text-gray-400">{data.detail}</p>}
      </div>
    );
  }

  const { summary, previous, daily, users, cohorts } = data;

  // Averages are per active person, not per account — dividing by everyone who
  // ever signed up would flatter a quiet week into looking like a busy one.
  const visitsPerUser = summary.activeUsers > 0 ? summary.visits / summary.activeUsers : 0;
  const viewsPerVisit = summary.visits > 0 ? summary.memberViews / summary.visits : 0;
  const daysPerUser = summary.activeUsers > 0 ? summary.activeDays / summary.activeUsers : 0;
  const activationRate = summary.newUsers > 0 ? (summary.newActiveUsers / summary.newUsers) * 100 : 0;
  const reachRate = summary.totalUsers > 0 ? (summary.activeUsers / summary.totalUsers) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          icon={Users}
          label="Nutzer gesamt"
          value={summary.totalUsers}
          previous={previous.totalUsers}
          hint={`${formatNumber(reachRate, 0)} % im Zeitraum aktiv`}
        />
        <StatCard
          icon={UserPlus}
          label="Neue Anmeldungen"
          value={summary.newUsers}
          previous={previous.newUsers}
          hint={
            summary.newUsers > 0
              ? `${summary.newActiveUsers} davon aktiv (${formatNumber(activationRate, 0)} %)`
              : 'keine im Zeitraum'
          }
        />
        <StatCard
          icon={Activity}
          label="Aktive Nutzer"
          value={summary.activeUsers}
          previous={previous.activeUsers}
          hint={`${formatNumber(daysPerUser, 1)} aktive Tage / Nutzer`}
        />
        <StatCard
          icon={Repeat}
          label="Wiederkehrend"
          value={summary.returningUsers}
          previous={previous.returningUsers}
          hint={`${summary.repeatUsers} an 2+ Tagen aktiv`}
        />
        <StatCard
          icon={LogIn}
          label="Besuche"
          value={summary.visits}
          previous={previous.visits}
          hint={`${formatNumber(visitsPerUser, 1)} / Nutzer · ${formatNumber(viewsPerVisit, 1)} Seiten/Besuch`}
        />
        <StatCard
          icon={UserX}
          label="Nicht zurückgekehrt"
          value={summary.dormantUsers}
          previous={previous.dormantUsers}
          hint="vorher angemeldet, im Zeitraum inaktiv"
          invertDelta
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 flex flex-col">
          <SectionTitle
            icon={<Activity size={14} className="text-accent" />}
            right={
              <>
                <LegendKey color={VISITOR_COLOR} label="Neu (am selben Tag angemeldet)" />
                <LegendKey color={MEMBER_COLOR} label="Wiederkehrend" />
              </>
            }
          >
            Aktive Nutzer pro Tag
          </SectionTitle>
          <ActivityChart daily={daily} />
        </section>

        <section className="flex flex-col">
          <SectionTitle icon={<UserPlus size={14} className="text-accent" />}>
            Anmeldungen pro Tag
          </SectionTitle>
          <SignupChart daily={daily} />
        </section>
      </div>

      <RetentionGrid cohorts={cohorts} />

      <UserTable users={users} query={query} trackingSince={summary.trackingSince} />
    </div>
  );
}

/* ─── Active users per day ─── */

/**
 * Stacked bars: people who signed up that same day sit below people who were
 * already here. The split is the whole point — a tall bar made only of new
 * signups is a launch, the same bar made of returning users is a habit.
 */
function ActivityChart({ daily }: { daily: DailyRow[] }) {
  const max = Math.max(...daily.map((d) => d.active_users), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex-1 flex flex-col">
      <div className="flex items-end gap-[2px] flex-1 min-h-44">
        {daily.map((d, i) => {
          const segments = [
            { key: 'returning', value: d.returning_active_users, color: MEMBER_COLOR, label: 'Wiederkehrend' },
            { key: 'new', value: d.new_active_users, color: VISITOR_COLOR, label: 'Neu' },
          ].filter((s) => s.value > 0);

          return (
            <div key={d.day} className="flex-1 group relative flex flex-col items-center justify-end h-full gap-[2px]">
              <ChartTooltip index={i} count={daily.length}>
                <div className="font-medium mb-0.5">
                  {formatWeekday(d.day)} {formatDay(d.day)} · {d.active_users} aktiv
                </div>
                <div>Wiederkehrend: {d.returning_active_users}</div>
                <div>Neu: {d.new_active_users}</div>
                <div className="text-gray-300 mt-0.5">
                  {d.visits} Besuche · {d.member_views} Aufrufe
                </div>
              </ChartTooltip>

              {segments.length === 0 ? (
                <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: '2px' }} />
              ) : (
                segments.map((s, si) => (
                  <div
                    key={s.key}
                    className={`w-full min-h-[3px] ${si === 0 ? 'rounded-t-[3px]' : ''}`}
                    style={{ height: `${(s.value / max) * 100}%`, backgroundColor: s.color }}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
      <DayAxis days={daily.map((d) => d.day)} />
    </div>
  );
}

/* ─── Signups per day ─── */

/**
 * Its own chart rather than a second axis on the one beside it: signups and
 * active users have completely different scales, and overlaying them would
 * invent a relationship the numbers do not have.
 */
function SignupChart({ daily }: { daily: DailyRow[] }) {
  const max = Math.max(...daily.map((d) => d.signups), 1);
  const total = daily.reduce((sum, d) => sum + d.signups, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex-1 flex flex-col">
      <div className="flex items-end gap-[2px] flex-1 min-h-44">
        {daily.map((d, i) => (
          <div key={d.day} className="flex-1 group relative flex flex-col items-center justify-end h-full">
            <ChartTooltip index={i} count={daily.length}>
              <div className="font-medium">
                {formatWeekday(d.day)} {formatDay(d.day)}
              </div>
              <div>
                {d.signups} {d.signups === 1 ? 'Anmeldung' : 'Anmeldungen'}
              </div>
              <div className="text-gray-300 mt-0.5">{d.total_users} Nutzer gesamt</div>
            </ChartTooltip>
            {d.signups > 0 ? (
              <div
                className="w-full min-h-[3px] rounded-t-[3px]"
                style={{ height: `${(d.signups / max) * 100}%`, backgroundColor: VISITOR_COLOR }}
              />
            ) : (
              <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: '2px' }} />
            )}
          </div>
        ))}
      </div>
      <DayAxis days={daily.map((d) => d.day)} max={4} />
      <p className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
        <span className="font-medium text-gray-900">{formatNumber(total)}</span> im Zeitraum ·{' '}
        {formatNumber(daily[daily.length - 1]?.total_users ?? 0)} Nutzer gesamt
      </p>
    </div>
  );
}

/* ─── Chart furniture ─── */

/**
 * Tooltips at the edges of the chart would be clipped by the card if they
 * stayed centred, so the outer sixth on each side anchors to its own edge.
 */
function ChartTooltip({
  index,
  count,
  children,
}: {
  index: number;
  count: number;
  children: React.ReactNode;
}) {
  const position =
    index < count / 6
      ? 'left-0'
      : index > count - count / 6
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  return (
    <div
      className={`absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 text-left pointer-events-none ${position}`}
    >
      {children}
    </div>
  );
}

/* ─── Retention ─── */

/**
 * Signup week against the weeks that followed. Reading across a row answers
 * "did that intake stick"; reading down a column answers "is it getting
 * better". Week 0 is the signup week itself and is nearly always 100 %.
 */
function RetentionGrid({ cohorts }: { cohorts: CohortRow[] }) {
  const weeks = useMemo(() => {
    const byWeek = new Map<string, { size: number; offsets: Map<number, number> }>();
    for (const row of cohorts) {
      const week = row.cohort_week;
      if (!byWeek.has(week)) byWeek.set(week, { size: Number(row.cohort_size), offsets: new Map() });
      byWeek.get(week)!.offsets.set(Number(row.week_offset), Number(row.active_users));
    }
    return [...byWeek.entries()].map(([week, value]) => ({ week, ...value }));
  }, [cohorts]);

  if (weeks.length === 0) {
    return (
      <section>
        <SectionTitle icon={<CalendarDays size={14} className="text-accent" />}>Kohorten-Retention</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-400">Noch keine Anmeldungen in den letzten 12 Wochen.</p>
        </div>
      </section>
    );
  }

  // Only render as many columns as any cohort could actually have reached.
  const maxOffset = Math.max(...weeks.map((w) => Math.max(0, ...w.offsets.keys())));
  const columns = Array.from({ length: Math.min(maxOffset, 11) + 1 }, (_, i) => i);

  return (
    <section>
      <SectionTitle icon={<CalendarDays size={14} className="text-accent" />}>
        Kohorten-Retention
        <span className="text-gray-400 font-normal">nach Anmeldewoche</span>
      </SectionTitle>
      <div className="bg-white border border-gray-200 rounded-lg p-4 overflow-x-auto">
        <table className="text-sm border-separate border-spacing-[2px]">
          <thead>
            <tr className="text-gray-500 text-xs">
              <th className="px-2 py-1 font-medium text-left whitespace-nowrap">Anmeldewoche</th>
              <th className="px-2 py-1 font-medium text-right whitespace-nowrap">Nutzer</th>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1 font-medium text-center w-14">
                  W{c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <td className="px-2 py-1 text-gray-700 whitespace-nowrap text-xs">{formatDate(w.week)}</td>
                <td className="px-2 py-1 text-right text-gray-900 tabular-nums font-medium">{w.size}</td>
                {columns.map((c) => {
                  const active = w.offsets.get(c);
                  // A cohort cannot have data for a week that has not happened
                  // yet — leave those blank rather than printing 0 %.
                  const reached = weekOffsetReached(w.week, c);
                  if (!reached) return <td key={c} className="px-2 py-1" />;
                  const ratio = w.size > 0 ? (active ?? 0) / w.size : 0;
                  // color-mix rather than `opacity`, which would fade the
                  // number along with the fill and made the weakest cells
                  // unreadable. Mixing toward transparent over the card
                  // surface gives a one-hue ramp that re-steps itself in dark
                  // mode, since the surface underneath changes with it.
                  const mix = ratio === 0 ? 8 : 15 + ratio * 85;
                  return (
                    <td
                      key={c}
                      className="px-2 py-1 text-center tabular-nums rounded"
                      style={{ backgroundColor: `color-mix(in srgb, ${MEMBER_COLOR} ${mix}%, transparent)` }}
                      title={`${active ?? 0} von ${w.size} aktiv`}
                    >
                      <span className={ratio === 0 ? 'text-gray-400' : ratio > 0.55 ? 'text-white' : 'text-gray-900'}>
                        {formatNumber(ratio * 100, 0)}%
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
          Anteil einer Anmeldewoche, der in der jeweiligen Folgewoche aktiv war. W0 ist die
          Anmeldewoche selbst. Leere Zellen liegen in der Zukunft.
        </p>
      </div>
    </section>
  );
}

/** Has enough time passed for `offset` weeks after `week` to have happened? */
function weekOffsetReached(week: string, offset: number): boolean {
  const start = new Date(`${week}T00:00:00Z`).getTime() + offset * 7 * 86400000;
  return start <= Date.now();
}

/* ─── The people themselves ─── */

type SortKey = 'views' | 'visits' | 'days' | 'signup' | 'lastSeen' | 'saved';
type Filter = 'all' | 'active' | 'new' | 'dormant';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'active', label: 'Aktiv' },
  { key: 'new', label: 'Neu' },
  { key: 'dormant', label: 'Inaktiv' },
];

function UserTable({
  users,
  query,
  trackingSince,
}: {
  users: UserRow[];
  query: string;
  trackingSince: string | null;
}) {
  const [sort, setSort] = useState<SortKey>('lastSeen');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = users.filter((u) => {
      if (filter === 'active' && !u.is_active) return false;
      if (filter === 'new' && !u.is_new) return false;
      if (filter === 'dormant' && u.is_active) return false;
      if (!needle) return true;
      return [u.username, u.display_name, u.email, u.home_club]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });

    const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
    const compare: Record<SortKey, (a: UserRow, b: UserRow) => number> = {
      views: (a, b) => b.views_in_range - a.views_in_range,
      visits: (a, b) => b.visits_in_range - a.visits_in_range,
      days: (a, b) => b.active_days_in_range - a.active_days_in_range,
      signup: (a, b) => time(b.signed_up_at) - time(a.signed_up_at),
      lastSeen: (a, b) => time(b.last_seen_at) - time(a.last_seen_at),
      saved: (a, b) =>
        b.saved_tournaments + b.saved_clubs - (a.saved_tournaments + a.saved_clubs),
    };
    return [...filtered].sort(compare[sort]);
  }, [users, sort, filter, search]);

  const maxViews = Math.max(...users.map((u) => u.views_in_range), 1);

  const downloadCsv = useCallback(() => {
    const header = [
      'username', 'display_name', 'email', 'signed_up_at', 'last_sign_in_at', 'last_seen_at',
      'views_in_range', 'visits_in_range', 'active_days_in_range', 'total_views',
      'saved_tournaments', 'saved_clubs', 'home_club', 'handicap',
    ];
    // Quote everything and double inner quotes — club names contain commas.
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const body = rows.map((u) =>
      [
        u.username, u.display_name, u.email, u.signed_up_at, u.last_sign_in_at, u.last_seen_at,
        u.views_in_range, u.visits_in_range, u.active_days_in_range, u.total_views,
        u.saved_tournaments, u.saved_clubs, u.home_club, u.handicap,
      ].map(escape).join(',')
    );
    const blob = new Blob([[header.join(','), ...body].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thepin-nutzer-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <section>
      <SectionTitle icon={<Users size={14} className="text-accent" />}>
        Nutzer
        <span className="text-gray-400 font-normal">({rows.length})</span>
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, E-Mail, Club…"
            className="pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-900 w-48"
          />
        </div>

        <button
          onClick={downloadCsv}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download size={13} />
          CSV
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 text-xs">
                <th className="px-4 py-2 font-medium">Nutzer</th>
                <SortHeader label="Angemeldet" active={sort === 'signup'} onClick={() => setSort('signup')} />
                <SortHeader label="Zuletzt aktiv" active={sort === 'lastSeen'} onClick={() => setSort('lastSeen')} />
                <SortHeader label="Besuche" active={sort === 'visits'} onClick={() => setSort('visits')} />
                <SortHeader label="Tage" active={sort === 'days'} onClick={() => setSort('days')} />
                <SortHeader label="Gespeichert" active={sort === 'saved'} onClick={() => setSort('saved')} />
                <SortHeader label="Aufrufe" active={sort === 'views'} onClick={() => setSort('views')} wide />
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => (
                <UserRowView
                  key={u.user_id}
                  user={u}
                  striped={i % 2 !== 0}
                  maxViews={maxViews}
                  expanded={expanded === u.user_id}
                  onToggle={() => setExpanded(expanded === u.user_id ? null : u.user_id)}
                  query={query}
                />
              ))}
              {rows.length === 0 && <EmptyRow cols={7}>Keine Nutzer für diese Auswahl</EmptyRow>}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
        Ein Besuch ist eine Folge von Seitenaufrufen ohne Pause von mehr als 30 Minuten.
        {trackingSince && ` Aufrufe werden seit dem ${formatDate(trackingSince)} einzelnen Nutzern zugeordnet.`}{' '}
        Als Admin bist du selbst vom Tracking ausgenommen.
      </p>
    </section>
  );
}

function SortHeader({
  label,
  active,
  onClick,
  wide,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <th className={`px-4 py-2 font-medium text-right ${wide ? 'w-32' : 'w-24'}`}>
      <button
        onClick={onClick}
        className={`hover:text-gray-900 transition-colors ${active ? 'text-gray-900 font-semibold' : ''}`}
      >
        {label}
      </button>
    </th>
  );
}

function UserRowView({
  user,
  striped,
  maxViews,
  expanded,
  onToggle,
  query,
}: {
  user: UserRow;
  striped: boolean;
  maxViews: number;
  expanded: boolean;
  onToggle: () => void;
  query: string;
}) {
  const saved = user.saved_tournaments + user.saved_clubs;

  return (
    <>
      <tr
        className={`${striped ? 'bg-gray-50/50' : 'bg-white'} cursor-pointer hover:bg-gray-50`}
        onClick={onToggle}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown size={13} className="text-gray-400 shrink-0" />
            ) : (
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
            )}
            <span className="font-medium text-gray-900">
              {user.username ? `@${user.username}` : user.display_name || 'ohne Namen'}
            </span>
            {user.is_new && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-light text-accent">
                neu
              </span>
            )}
            {user.role === 'admin' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                admin
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 ml-[19px] truncate max-w-[280px]">
            {user.email}
            {user.home_club ? ` · ${user.home_club}` : ''}
            {user.handicap !== null ? ` · HCP ${formatNumber(user.handicap, 1)}` : ''}
          </div>
        </td>
        <td className="px-4 py-2.5 text-right text-xs text-gray-500 whitespace-nowrap">
          {formatDate(user.signed_up_at)}
        </td>
        <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap">
          <span className={user.last_seen_at ? 'text-gray-700' : 'text-gray-400'}>
            {formatRelative(user.last_seen_at)}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{user.visits_in_range}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{user.active_days_in_range}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
          {saved > 0 ? (
            <span title={`${user.saved_tournaments} Turniere · ${user.saved_clubs} Clubs`}>{saved}</span>
          ) : (
            <span className="text-gray-300">–</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center gap-2 justify-end" title={`${user.total_views} Aufrufe insgesamt`}>
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(user.views_in_range / maxViews) * 100}%`,
                  backgroundColor: MEMBER_COLOR,
                }}
              />
            </div>
            <span className="font-medium text-gray-900 tabular-nums">{user.views_in_range}</span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/50">
          <td colSpan={7} className="px-4 py-3 border-t border-gray-100">
            <UserDetail key={`${user.user_id}-${query}`} user={user} query={query} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── What one person looked at ─── */

interface DetailPage {
  path: string;
  label: string | null;
  views: number;
  last_viewed: string;
}
interface DetailView {
  path: string;
  label: string | null;
  viewed_at: string;
  source: string | null;
}

/**
 * Mounted fresh for each user and each range — the caller keys it on both — so
 * the effect only ever has to move this from loading to loaded. Resetting the
 * state on a prop change instead would mean a setState inside the effect body,
 * and a render cascade on every expand.
 */
function UserDetail({ user, query }: { user: UserRow; query: string }) {
  const [detail, setDetail] = useState<{ topPages: DetailPage[]; recentViews: DetailView[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/analytics/users/${user.user_id}?${query}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user.user_id, query]);

  if (failed) {
    return <p className="text-xs text-gray-400 py-2">Details konnten nicht geladen werden.</p>;
  }
  if (!detail) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <Loader2 className="animate-spin" size={13} /> lädt…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Meist aufgerufen im Zeitraum
        </h4>
        {detail.topPages.length === 0 ? (
          <p className="text-xs text-gray-400">Keine Aufrufe im gewählten Zeitraum.</p>
        ) : (
          <ul className="space-y-1.5">
            {detail.topPages.map((p) => (
              <li key={p.path} className="flex items-baseline justify-between gap-3 text-xs">
                <a href={p.path} className="text-accent hover:underline truncate" title={p.path}>
                  {p.label ?? p.path}
                </a>
                <span className="tabular-nums text-gray-500 shrink-0">{p.views}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Zuletzt angesehen
        </h4>
        {detail.recentViews.length === 0 ? (
          <p className="text-xs text-gray-400">Noch keine zugeordneten Aufrufe.</p>
        ) : (
          <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {detail.recentViews.map((v, i) => (
              <li key={`${v.path}-${v.viewed_at}-${i}`} className="flex items-baseline justify-between gap-3 text-xs">
                <a href={v.path} className="text-accent hover:underline truncate" title={v.path}>
                  {v.label ?? v.path}
                </a>
                <span className="text-gray-400 shrink-0 tabular-nums">
                  {new Date(v.viewed_at).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {user.last_sign_in_at && (
          <p className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
            Letzter Login: {formatDate(user.last_sign_in_at)}
          </p>
        )}
      </div>
    </div>
  );
}
