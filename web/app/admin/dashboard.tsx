'use client';

import { useCallback, useState } from 'react';
import { BarChart3, Users } from 'lucide-react';
import TrafficDashboard from './client';
import UsersDashboard from './users-client';
import RangePicker, { RangeSelection } from './range-picker';

type Tab = 'traffic' | 'users';

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'traffic', label: 'Traffic', icon: BarChart3 },
  { key: 'users', label: 'Nutzer', icon: Users },
];

/**
 * Shell for the admin dashboard.
 *
 * The range lives here rather than in either panel, so switching tabs keeps
 * whatever period you were looking at — comparing traffic and people over
 * different weeks without noticing is the easiest way to draw a wrong
 * conclusion from this page.
 *
 * Both panels stay mounted once opened: a tab switch then costs nothing, and
 * the fetch only re-runs when the range actually changes.
 */
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('traffic');
  const [seen, setSeen] = useState<Tab[]>(['traffic']);
  const [selection, setSelection] = useState<RangeSelection>({ key: '7d' });
  const [rangeMeta, setRangeMeta] = useState<{ from: string; to: string; days: number }>();

  // Stable identity: the panels list this in a dependency array, and a new
  // function every render would refetch in a loop.
  const onRangeMeta = useCallback((meta: { from: string; to: string; days: number }) => {
    setRangeMeta(meta);
  }, []);

  function openTab(next: Tab) {
    setTab(next);
    setSeen((current) => (current.includes(next) ? current : [...current, next]));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => openTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <RangePicker
          value={selection}
          onChange={setSelection}
          loading={false}
          resolved={rangeMeta}
        />
      </div>

      {seen.includes('traffic') && (
        <div hidden={tab !== 'traffic'}>
          <TrafficDashboard selection={selection} onRangeMeta={onRangeMeta} />
        </div>
      )}
      {seen.includes('users') && (
        <div hidden={tab !== 'users'}>
          <UsersDashboard selection={selection} onRangeMeta={onRangeMeta} />
        </div>
      )}
    </div>
  );
}
