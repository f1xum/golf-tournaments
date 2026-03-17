import Link from 'next/link';
import { Calendar, Building2, Map } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/utils';

export const revalidate = 3600; // revalidate every hour

async function getStats() {
  const today = todayISO();

  const [tournamentsRes, clubsRes, nextRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .gte('date_start', today),
    supabase
      .from('golf_clubs')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('tournaments')
      .select('name, date_start, club_id')
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(3),
  ]);

  return {
    tournamentCount: tournamentsRes.count ?? 0,
    clubCount: clubsRes.count ?? 0,
    nextTournaments: nextRes.data ?? [],
  };
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <div className="py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Golf Turniere Bayern
        </h1>
        <p className="text-gray-500 text-lg">
          Alle Golfturniere in Bayern auf einen Blick
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-12">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-accent">{stats.tournamentCount}</div>
          <div className="text-sm text-gray-500 mt-1">Kommende Turniere</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-accent">{stats.clubCount}</div>
          <div className="text-sm text-gray-500 mt-1">Golfclubs</div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-4">
        <Link
          href="/turniere"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
        >
          <div className="w-12 h-12 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
            <Calendar size={24} className="text-accent" />
          </div>
          <div>
            <div className="font-semibold text-lg">Turnierkalender</div>
            <div className="text-sm text-gray-500">Kalender- und Listenansicht aller Turniere</div>
          </div>
        </Link>

        <Link
          href="/clubs"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
        >
          <div className="w-12 h-12 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
            <Building2 size={24} className="text-accent" />
          </div>
          <div>
            <div className="font-semibold text-lg">Golfclubs</div>
            <div className="text-sm text-gray-500">Alle Golfclubs in Bayern im Überblick</div>
          </div>
        </Link>

        <Link
          href="/karte"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
        >
          <div className="w-12 h-12 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
            <Map size={24} className="text-accent" />
          </div>
          <div>
            <div className="font-semibold text-lg">Karte</div>
            <div className="text-sm text-gray-500">Clubs und Turniere auf der Karte</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
