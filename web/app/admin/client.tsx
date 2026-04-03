'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Eye, TrendingUp, Trophy, Building2, Loader2, ChevronDown, ChevronUp, Globe } from 'lucide-react';

interface TopPage {
  path: string;
  views: number;
}

interface TopTournament {
  path: string;
  views: number;
  tournament_name: string;
  club_name: string | null;
  club_city: string | null;
}

interface TopClub {
  path: string;
  views: number;
  club_name: string;
  club_city: string | null;
  club_region: string | null;
}

interface DailyView {
  day: string;
  views: number;
}

interface AnalyticsData {
  totalViews: number;
  todayViews: number;
  topPages: TopPage[];
  topTournaments: TopTournament[];
  topClubs: TopClub[];
  dailyViews: DailyView[];
  range: string;
}

const RANGES = [
  { value: '7d', label: '7 Tage' },
  { value: '30d', label: '30 Tage' },
  { value: '90d', label: '90 Tage' },
];

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?range=${range}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  if (!data) return null;

  // Fill missing days in the range so the chart always shows every day
  const daysBack = range === '30d' ? 30 : range === '90d' ? 90 : 7;
  const filledDaily = fillDays(data.dailyViews, daysBack);
  const maxDaily = Math.max(...filledDaily.map((d) => d.views), 1);

  // Categorize pages for the breakdown
  const breakdown = categorizePages(data.topPages);

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              range === r.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
        {loading && <Loader2 className="animate-spin text-gray-400 ml-2 self-center" size={14} />}
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Eye} label="Heute" value={data.todayViews} />
        <StatCard icon={TrendingUp} label={`Gesamt (${RANGES.find((r) => r.value === range)?.label})`} value={data.totalViews} />
        <StatCard
          icon={BarChart3}
          label="Ø / Tag"
          value={filledDaily.length > 0 ? Math.round(data.totalViews / filledDaily.length) : 0}
        />
        <StatCard
          icon={TrendingUp}
          label="Peak Tag"
          value={Math.max(...filledDaily.map((d) => d.views))}
        />
      </div>

      {/* Two-column layout for chart + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily chart — takes 2/3 */}
        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Seitenaufrufe pro Tag</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-end gap-[2px] h-44">
              {filledDaily.map((d) => {
                const pct = (d.views / maxDaily) * 100;
                const date = new Date(d.day);
                const label = formatDay(d.day);
                const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
                return (
                  <div
                    key={d.day}
                    className="flex-1 group relative flex flex-col items-center justify-end h-full"
                  >
                    <div className="absolute -top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {weekday} {label}: <strong>{d.views}</strong> Aufrufe
                    </div>
                    <div
                      className={`w-full rounded-t-sm min-h-[2px] transition-all ${
                        d.views > 0
                          ? 'bg-accent/80 hover:bg-accent'
                          : 'bg-gray-100'
                      }`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* X-axis labels */}
            <div className="flex mt-2 text-[10px] text-gray-400">
              {filledDaily.map((d, i) => {
                // Show label every N days depending on range
                const step = daysBack <= 7 ? 1 : daysBack <= 30 ? 5 : 10;
                const show = i === 0 || i === filledDaily.length - 1 || i % step === 0;
                return (
                  <div key={d.day} className="flex-1 text-center">
                    {show ? formatDay(d.day) : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Page category breakdown — takes 1/3 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Seitentypen</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4 h-[calc(100%-28px)]">
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
            </div>
          </div>
        </section>
      </div>

      {/* Two-column: Top Tournaments + Top Clubs */}
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
                <ViewBar value={t.views} max={data.topTournaments[0]?.views ?? 1} />
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
                <ViewBar value={c.views} max={data.topClubs[0]?.views ?? 1} />
              </td>
            </tr>
          )}
          emptyText="Noch keine Club-Aufrufe"
          cols={3}
        />
      </div>

      {/* Top Pages — full width at bottom */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <Globe size={14} className="text-accent" />
          Top Seiten
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Seite</th>
                <th className="px-4 py-2 font-medium text-right w-32">Aufrufe</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.slice(0, 10).map((p, i) => (
                <tr key={p.path} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700 truncate max-w-[400px]">
                    {p.path}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ViewBar value={p.views} max={data.topPages[0]?.views ?? 1} />
                  </td>
                </tr>
              ))}
              {data.topPages.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Noch keine Daten</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
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
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
        {icon}
        {title}
        <span className="text-gray-400 font-normal">({items.length})</span>
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {visible.map((item, i) => renderRow(item, i))}
            {items.length === 0 && (
              <tr><td colSpan={cols} className="px-4 py-6 text-center text-gray-400">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
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

/* ─── Helper Components ─── */

function StatCard({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gray-400" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString('de-DE')}</div>
    </div>
  );
}

function ViewBar({ value, max }: { value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-medium text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

/* ─── Helpers ─── */

function formatDay(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}

/** Fill missing days so chart always has one bar per day in the range */
function fillDays(dailyViews: DailyView[], daysBack: number): DailyView[] {
  const map = new Map(dailyViews.map((d) => [d.day, d.views]));
  const result: DailyView[] = [];
  const now = new Date();

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    result.push({ day: key, views: map.get(key) ?? 0 });
  }

  return result;
}

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
