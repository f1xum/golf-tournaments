'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Share2,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { RangeSelection, rangeQuery } from './range-picker';
import {
  DayAxis,
  EmptyRow,
  LegendKey,
  MEMBER_COLOR,
  SectionTitle,
  StatCard,
  UNTRACKED_COLOR,
  VISITOR_COLOR,
  ViewBar,
  formatDate,
  formatDay,
  formatNumber,
  formatWeekday,
} from './shared';

interface TopPage {
  path: string;
  views: number;
  member_views: number;
  visitors: number;
}

interface TopTournament {
  path: string;
  views: number;
  member_views: number;
  tournament_name: string;
  club_name: string | null;
  club_city: string | null;
}

interface TopClub {
  path: string;
  views: number;
  member_views: number;
  club_name: string;
  club_city: string | null;
  club_region: string | null;
}

interface DailyView {
  day: string;
  views: number;
  member_views: number;
  visitor_views: number;
  untracked_views: number;
  active_users: number;
  visits: number;
}

interface Audience {
  memberViews: number;
  visitorViews: number;
  untrackedViews: number;
  activeUsers: number;
  trackingSince: string | null;
}

interface TrafficSourceRow {
  source: string;
  medium: string | null;
  views: number;
  visits: number;
  member_views: number;
}

interface TrafficCampaignRow extends TrafficSourceRow {
  campaign: string | null;
}

interface ReferrerRow {
  referrer_host: string;
  views: number;
  visits: number;
}

interface Traffic {
  visits: number;
  attributedViews: number;
  untrackedViews: number;
  trackingSince: string | null;
  sources: TrafficSourceRow[];
  campaigns: TrafficCampaignRow[];
  referrers: ReferrerRow[];
}

interface AnalyticsData {
  range: { key: string; from: string; to: string; days: number };
  totalViews: number;
  previous: { totalViews: number; memberViews: number; activeUsers: number; visits: number };
  audience: Audience;
  traffic: Traffic;
  topPages: TopPage[];
  topTournaments: TopTournament[];
  topClubs: TopClub[];
  dailyViews: DailyView[];
}

export default function TrafficDashboard({
  selection,
  onRangeMeta,
}: {
  selection: RangeSelection;
  onRangeMeta: (meta: { from: string; to: string; days: number }) => void;
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const query = rangeQuery(selection);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/analytics?${query}`)
      .then((r) => r.json())
      .then((d: AnalyticsData) => {
        if (cancelled) return;
        setData(d);
        if (d.range) onRangeMeta(d.range);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // onRangeMeta is stable; including it would refetch on every parent render.
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

  // The server emits one row per day in the range, empty days included, so
  // the chart no longer has to pad anything.
  const daily = data.dailyViews;
  const maxDaily = Math.max(...daily.map((d) => d.views), 1);
  const breakdown = categorizePages(data.topPages);

  // Rows from before migration 022 carry no identity, so they get their own
  // neutral segment instead of being lumped in with real anonymous visitors.
  const hasUntracked = data.audience.untrackedViews > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Seitenaufrufe"
          value={data.totalViews}
          previous={data.previous.totalViews}
        />
        <StatCard
          icon={Eye}
          label="Besuche"
          value={data.traffic.visits}
          previous={data.previous.visits}
          hint={
            data.traffic.visits > 0
              ? `${formatNumber(data.totalViews / data.traffic.visits, 1)} Seiten / Besuch`
              : undefined
          }
        />
        <StatCard
          icon={Users}
          label="Aktive Nutzer"
          value={data.audience.activeUsers}
          previous={data.previous.activeUsers}
          hint={
            data.audience.activeUsers > 0
              ? `${formatNumber(data.audience.memberViews / data.audience.activeUsers, 1)} Seiten / Nutzer`
              : 'noch keine eingeloggten Aufrufe'
          }
        />
        <StatCard
          icon={BarChart3}
          label="Ø / Tag"
          value={daily.length > 0 ? Math.round(data.totalViews / daily.length) : 0}
        />
        <StatCard
          icon={TrendingUp}
          label="Peak Tag"
          value={Math.max(...daily.map((d) => d.views), 0)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 flex flex-col">
          <SectionTitle>Seitenaufrufe pro Tag</SectionTitle>
          <div className="bg-white border border-gray-200 rounded-lg p-4 flex-1 flex flex-col">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">
              <LegendKey color={MEMBER_COLOR} label="Eingeloggt" />
              <LegendKey color={VISITOR_COLOR} label="Besucher" />
              {hasUntracked && <LegendKey color={UNTRACKED_COLOR} label="ohne Aufschlüsselung" />}
            </div>
            <div className="flex items-end gap-[2px] flex-1 min-h-44">
              {daily.map((d, i) => {
                // Stack top-down: members, then visitors, then the pre-cutoff
                // rows we cannot attribute. The three always sum to d.views.
                const segments = [
                  { key: 'member', value: d.member_views, color: MEMBER_COLOR },
                  { key: 'visitor', value: d.visitor_views, color: VISITOR_COLOR },
                  { key: 'untracked', value: d.untracked_views, color: UNTRACKED_COLOR },
                ].filter((s) => s.value > 0);

                const position =
                  i < daily.length / 6
                    ? 'left-0'
                    : i > daily.length - daily.length / 6
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2';

                return (
                  <div
                    key={d.day}
                    className="flex-1 group relative flex flex-col items-center justify-end h-full gap-[2px]"
                  >
                    <div
                      className={`absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 text-left pointer-events-none ${position}`}
                    >
                      <div className="font-medium mb-0.5">
                        {formatWeekday(d.day)} {formatDay(d.day)}: {d.views} Aufrufe
                      </div>
                      <div>Eingeloggt: {d.member_views} ({d.active_users} Nutzer)</div>
                      <div>Besucher: {d.visitor_views}</div>
                      {d.untracked_views > 0 && <div>Ohne Aufschlüsselung: {d.untracked_views}</div>}
                    </div>
                    {segments.length === 0 ? (
                      <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: '2px' }} />
                    ) : (
                      segments.map((s, si) => (
                        <div
                          key={s.key}
                          className={`w-full min-h-[3px] ${si === 0 ? 'rounded-t-[3px]' : ''}`}
                          style={{
                            height: `${(s.value / maxDaily) * 100}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
            <DayAxis days={daily.map((d) => d.day)} />
          </div>
        </section>

        <div className="space-y-4">
          <section>
            <SectionTitle>Publikum</SectionTitle>
            <AudiencePanel audience={data.audience} />
          </section>

          <section>
            <SectionTitle>Seitentypen</SectionTitle>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="space-y-3">
                {breakdown.map((cat) => (
                  <div key={cat.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{cat.label}</span>
                      <span className="font-medium text-gray-900 tabular-nums">{cat.views}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(cat.views / Math.max(data.totalViews, 1)) * 100}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {breakdown.length === 0 && <p className="text-sm text-gray-400">Noch keine Daten</p>}
              </div>
            </div>
          </section>
        </div>
      </div>

      <TrafficSection traffic={data.traffic} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExpandableTable
          title="Top Turniere"
          icon={<Trophy size={14} className="text-accent" />}
          items={data.topTournaments}
          renderRow={(t, i) => (
            <tr key={t.path} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className="px-4 py-2.5 text-gray-400 text-xs w-8">{i + 1}</td>
              <td className="px-4 py-2.5">
                <Link href={t.path} className="text-accent hover:underline font-medium text-sm">
                  {t.tournament_name}
                </Link>
                <div className="text-xs text-gray-400 mt-0.5">
                  {t.club_name}{t.club_city ? ` · ${t.club_city}` : ''}
                </div>
              </td>
              <td className="px-4 py-2.5 text-right w-28">
                <ViewBar value={t.views} memberValue={t.member_views} max={data.topTournaments[0]?.views ?? 1} />
              </td>
            </tr>
          )}
          emptyText="Noch keine Turnier-Aufrufe"
          cols={3}
        />

        <ExpandableTable
          title="Top Clubs"
          icon={<Building2 size={14} className="text-accent" />}
          items={data.topClubs}
          renderRow={(c, i) => (
            <tr key={c.path} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className="px-4 py-2.5 text-gray-400 text-xs w-8">{i + 1}</td>
              <td className="px-4 py-2.5">
                <Link href={c.path} className="text-accent hover:underline font-medium text-sm">
                  {c.club_name}
                </Link>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.club_city}{c.club_region ? ` · ${c.club_region}` : ''}
                </div>
              </td>
              <td className="px-4 py-2.5 text-right w-28">
                <ViewBar value={c.views} memberValue={c.member_views} max={data.topClubs[0]?.views ?? 1} />
              </td>
            </tr>
          )}
          emptyText="Noch keine Club-Aufrufe"
          cols={3}
        />
      </div>

      <section>
        <SectionTitle icon={<Globe size={14} className="text-accent" />}>Top Seiten</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Seite</th>
                <th className="px-4 py-2 font-medium text-right w-24">Nutzer</th>
                <th className="px-4 py-2 font-medium text-right w-32">Aufrufe</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.slice(0, 12).map((p, i) => (
                <tr key={p.path} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700 truncate max-w-[400px]">
                    {p.path}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500 text-xs">
                    {p.visitors > 0 ? p.visitors : '–'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ViewBar value={p.views} memberValue={p.member_views} max={data.topPages[0]?.views ?? 1} />
                  </td>
                </tr>
              ))}
              {data.topPages.length === 0 && <EmptyRow cols={3}>Noch keine Daten</EmptyRow>}
            </tbody>
          </table>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          „Nutzer“ zählt verschiedene eingeloggte Personen — anonyme Besucher lassen sich nicht
          auseinanderhalten.
        </p>
      </section>
    </div>
  );
}

/* ─── Traffic attribution ─── */

/** Friendly names for the sources lib/traffic-source.ts can produce. */
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  telegram: 'Telegram',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  ecosia: 'Ecosia',
  yahoo: 'Yahoo',
  brave: 'Brave',
  startpage: 'Startpage',
  yandex: 'Yandex',
  email: 'E-Mail',
  direct: 'Direkt / Lesezeichen',
};

const MEDIUM_LABELS: Record<string, string> = {
  social: 'Social Media',
  organic: 'Suchmaschine',
  referral: 'Verweis',
  email: 'E-Mail',
  cpc: 'Anzeige',
  none: 'ohne Verweis',
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** "3,2 Seiten/Besuch", or a dash when there is no visit to divide by. */
function perVisit(views: number, visits: number): string {
  if (visits <= 0) return '–';
  return `${formatNumber(views / visits, 1)} Seiten/Besuch`;
}

function TrafficSection({ traffic }: { traffic: Traffic | undefined }) {
  if (!traffic) return null;

  const { sources, campaigns, referrers } = traffic;
  const maxSourceViews = sources[0]?.views ?? 1;

  return (
    <section>
      <SectionTitle
        icon={<Share2 size={14} className="text-accent" />}
        right={
          <>
            <LegendKey color={VISITOR_COLOR} label="Besucher" />
            <LegendKey color={MEMBER_COLOR} label="Eingeloggt" />
          </>
        }
      >
        Woher kommen die Besucher
        <span className="text-gray-400 font-normal">
          ({formatNumber(traffic.visits)} Besuche)
        </span>
      </SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Quelle</th>
                  <th className="px-4 py-2 font-medium text-right w-24">Besuche</th>
                  <th className="px-4 py-2 font-medium text-right w-32">Aufrufe</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr key={s.source} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{sourceLabel(s.source)}</span>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {s.medium ? MEDIUM_LABELS[s.medium] ?? s.medium : 'unbekannt'}
                        {' · '}
                        {perVisit(s.views, s.visits)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900 tabular-nums">
                      {formatNumber(s.visits)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ViewBar value={s.views} memberValue={s.member_views} max={maxSourceViews} />
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <EmptyRow cols={3}>
                    Noch keine Quellen erfasst – Instagram-Link:{' '}
                    <span className="font-mono text-gray-500">thepin.app/ig</span>
                  </EmptyRow>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {campaigns.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Kampagnen / Platzierungen
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <tbody>
                    {campaigns.map((c, i) => (
                      <tr
                        key={`${c.source}-${c.medium}-${c.campaign}`}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                      >
                        <td className="px-4 py-2">
                          <span className="text-gray-900">{sourceLabel(c.source)}</span>
                          <span className="text-gray-400"> · </span>
                          <span className="font-mono text-xs text-gray-600">{c.campaign}</span>
                        </td>
                        <td className="px-4 py-2 text-right w-24 tabular-nums text-gray-900">
                          {formatNumber(c.visits)}
                        </td>
                        <td className="px-4 py-2 text-right w-32">
                          <ViewBar
                            value={c.views}
                            memberValue={c.member_views}
                            max={campaigns[0]?.views ?? 1}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            <ExternalLink size={12} />
            Verweisende Seiten
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            {referrers.length === 0 ? (
              <p className="text-sm text-gray-400">
                Noch keine Verweise – Besucher kamen direkt oder über die App.
              </p>
            ) : (
              <ul className="space-y-2">
                {referrers.map((r) => (
                  <li key={r.referrer_host} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-mono text-xs text-gray-600 truncate" title={r.referrer_host}>
                      {r.referrer_host}
                    </span>
                    <span className="tabular-nums text-gray-900 shrink-0">
                      {formatNumber(r.visits)}
                      <span className="text-gray-400 text-xs ml-1">/ {formatNumber(r.views)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
              Besuche / Aufrufe. Instagram und Facebook liefern oft keine verweisende Seite – die
              stehen links trotzdem drin.
            </p>
          </div>
        </div>
      </div>

      {traffic.untrackedViews > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          {formatNumber(traffic.untrackedViews)} Aufrufe stammen aus der Zeit vor der
          Quellen-Erfassung{traffic.trackingSince ? ` (${formatDate(traffic.trackingSince)})` : ''}{' '}
          und haben keine Quelle.
        </p>
      )}
    </section>
  );
}

/* ─── Expandable Table ─── */

function ExpandableTable<T>({
  title,
  icon,
  items,
  renderRow,
  emptyText,
  cols,
}: {
  title: string;
  icon: React.ReactNode;
  items: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyText: string;
  cols: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);
  const hasMore = items.length > 5;

  return (
    <section>
      <SectionTitle icon={icon}>
        {title}
        <span className="text-gray-400 font-normal">({items.length})</span>
      </SectionTitle>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <tbody>
              {visible.map((item, i) => renderRow(item, i))}
              {items.length === 0 && <EmptyRow cols={cols}>{emptyText}</EmptyRow>}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 border-t border-gray-100"
          >
            {expanded ? (
              <>Weniger anzeigen <ChevronUp size={12} /></>
            ) : (
              <>Alle {items.length} anzeigen <ChevronDown size={12} /></>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── Audience split ─── */

function AudiencePanel({ audience }: { audience: Audience }) {
  const { memberViews, visitorViews, untrackedViews, activeUsers, trackingSince } = audience;
  const attributed = memberViews + visitorViews;
  const memberPct = attributed > 0 ? (memberViews / attributed) * 100 : 0;

  const rows = [
    { label: 'Besucher (anonym)', value: visitorViews, color: VISITOR_COLOR },
    { label: 'Eingeloggt', value: memberViews, color: MEMBER_COLOR },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {attributed === 0 ? (
        <p className="text-sm text-gray-400">
          Noch keine Aufrufe mit Nutzer-Zuordnung im gewählten Zeitraum.
        </p>
      ) : (
        <>
          {/* Split bar — the 2px gap keeps the two segments readable */}
          <div className="flex gap-[2px] h-2.5 mb-3">
            <div
              className="rounded-l-full transition-all"
              style={{ width: `${100 - memberPct}%`, backgroundColor: VISITOR_COLOR }}
            />
            <div
              className="rounded-r-full transition-all"
              style={{ width: `${memberPct}%`, backgroundColor: MEMBER_COLOR }}
            />
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                  {r.label}
                </span>
                <span className="text-gray-900 tabular-nums">
                  <span className="font-medium">{formatNumber(r.value)}</span>
                  <span className="text-gray-400 text-xs ml-1.5">
                    {formatNumber((r.value / attributed) * 100, 1)} %
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-600">Aktive Nutzer</span>
            <span className="font-medium text-gray-900 tabular-nums">{formatNumber(activeUsers)}</span>
          </div>
        </>
      )}

      {untrackedViews > 0 && (
        <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
          {formatNumber(untrackedViews)} Aufrufe stammen aus der Zeit vor der
          Umstellung{trackingSince ? ` (${formatDate(trackingSince)})` : ''} und lassen sich
          nicht zuordnen.
        </p>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

/** Group page views by category for the breakdown chart */
function categorizePages(pages: TopPage[]) {
  const cats: Record<string, { label: string; views: number; color: string }> = {
    home: { label: 'Startseite', views: 0, color: '#4f46e5' },
    tournaments: { label: 'Turniere', views: 0, color: '#059669' },
    clubs: { label: 'Clubs', views: 0, color: '#d97706' },
    map: { label: 'Karte', views: 0, color: '#dc2626' },
    other: { label: 'Sonstige', views: 0, color: '#6b7280' },
  };

  for (const p of pages) {
    if (p.path === '/') cats.home.views += p.views;
    else if (p.path.startsWith('/turniere')) cats.tournaments.views += p.views;
    else if (p.path.startsWith('/clubs')) cats.clubs.views += p.views;
    else if (p.path.startsWith('/karte')) cats.map.views += p.views;
    else cats.other.views += p.views;
  }

  return Object.values(cats).filter((c) => c.views > 0).sort((a, b) => b.views - a.views);
}
