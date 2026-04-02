'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Eye, TrendingUp, Trophy, Building2, Loader2 } from 'lucide-react';

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

  const maxDaily = Math.max(...data.dailyViews.map((d) => d.views), 1);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={Eye} label="Heute" value={data.todayViews} />
        <StatCard icon={TrendingUp} label={`Gesamt (${RANGES.find((r) => r.value === range)?.label})`} value={data.totalViews} />
        <StatCard
          icon={BarChart3}
          label="Ø / Tag"
          value={data.dailyViews.length > 0
            ? Math.round(data.totalViews / data.dailyViews.length)
            : 0
          }
        />
      </div>

      {/* Daily chart */}
      {data.dailyViews.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Seitenaufrufe pro Tag</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-end gap-[2px] h-32">
              {data.dailyViews.map((d) => {
                const pct = (d.views / maxDaily) * 100;
                const date = new Date(d.day);
                const label = `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.`;
                return (
                  <div
                    key={d.day}
                    className="flex-1 group relative flex flex-col items-center justify-end h-full"
                  >
                    <div className="absolute -top-6 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {label}: {d.views}
                    </div>
                    <div
                      className="w-full bg-accent/80 rounded-t-sm min-h-[2px] transition-all hover:bg-accent"
                      style={{ height: `${Math.max(pct, 1.5)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>{formatDay(data.dailyViews[0]?.day)}</span>
              <span>{formatDay(data.dailyViews[data.dailyViews.length - 1]?.day)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Top pages */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Seiten</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Seite</th>
                <th className="px-4 py-2 font-medium text-right">Aufrufe</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.map((p, i) => (
                <tr key={p.path} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700 truncate max-w-[200px]">
                    {p.path}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
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

      {/* Top tournaments */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <Trophy size={14} className="text-accent" />
          Top Turniere
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Turnier</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Club</th>
                <th className="px-4 py-2 font-medium text-right">Aufrufe</th>
              </tr>
            </thead>
            <tbody>
              {data.topTournaments.map((t, i) => (
                <tr key={t.path} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link href={t.path} className="text-accent hover:underline font-medium text-xs sm:text-sm">
                      {t.tournament_name}
                    </Link>
                    <div className="text-xs text-gray-400 sm:hidden">
                      {t.club_name}{t.club_city ? ` · ${t.club_city}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs hidden sm:table-cell">
                    {t.club_name}{t.club_city ? ` · ${t.club_city}` : ''}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ViewBar value={t.views} max={data.topTournaments[0]?.views ?? 1} />
                  </td>
                </tr>
              ))}
              {data.topTournaments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Noch keine Daten</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top clubs */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <Building2 size={14} className="text-accent" />
          Top Clubs
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Club</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Region</th>
                <th className="px-4 py-2 font-medium text-right">Aufrufe</th>
              </tr>
            </thead>
            <tbody>
              {data.topClubs.map((c, i) => (
                <tr key={c.path} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link href={c.path} className="text-accent hover:underline font-medium text-xs sm:text-sm">
                      {c.club_name}
                    </Link>
                    <div className="text-xs text-gray-400">
                      {c.club_city}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs hidden sm:table-cell">
                    {c.club_region}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ViewBar value={c.views} max={data.topClubs[0]?.views ?? 1} />
                  </td>
                </tr>
              ))}
              {data.topClubs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Noch keine Daten</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

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

function formatDay(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}
