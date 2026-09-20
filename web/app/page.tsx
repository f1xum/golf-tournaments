import Link from 'next/link';
import { Calendar, Building2, Map, ArrowRight } from 'lucide-react';
import { createPublicClient } from '@/lib/supabase/public';
import { todayISO } from '@/lib/utils';
import { BUNDESLAENDER } from '@/lib/regions';
import HomeCta from '@/components/home-cta';

export const revalidate = 3600;

async function getData() {
  const supabase = createPublicClient();
  const today = todayISO();

  const [countRes, clubCountRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .gte('date_start', today),
    supabase
      .from('golf_clubs')
      .select('id', { count: 'exact', head: true })
      // Headline count should match what /clubs actually lists.
      .is('merged_into', null),
  ]);

  return {
    tournamentCount: countRes.count ?? 0,
    clubCount: clubCountRes.count ?? 0,
  };
}

export default async function HomePage() {
  const { tournamentCount, clubCount } = await getData();

  return (
    <div className="py-5">
      {/* Hero */}
      <div className="flex items-center gap-3 mb-5">
        <img src="/logo.png" alt="The Pin" width={50} height={50} className="rounded" />
        <div>
          <h2 className="text-base font-bold">The Pin: Deine App für Golfturniere in Deutschland</h2>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/turniere"
          className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
        >
          <div className="text-2xl font-bold text-accent">{tournamentCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Kommende Turniere</div>
        </Link>
        <Link
          href="/clubs"
          className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
        >
          <div className="text-2xl font-bold text-accent">{clubCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Golfclubs</div>
        </Link>
      </div>

      <HomeCta />

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
            <div className="text-sm text-gray-500">Alle Golfclubs in Deutschland im Überblick</div>
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

      {/* Golfturniere nach Bundesland — SEO geo hub links */}
      <section className="mt-8">
        <h2 className="text-lg font-bold mb-1">Golfturniere nach Bundesland</h2>
        <p className="text-sm text-gray-500 mb-4">
          Finde Golfturniere in deiner Region – von Bayern bis Schleswig-Holstein.
        </p>
        <div className="flex flex-wrap gap-2">
          {BUNDESLAENDER.map((b) => (
            <Link
              key={b.slug}
              href={`/golfturniere/${b.slug}`}
              className="text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent/40 hover:text-accent transition-colors"
            >
              {b.name}
            </Link>
          ))}
        </div>
        <div className="mt-3">
          <Link href="/golfturniere" className="text-accent text-sm font-medium inline-flex items-center gap-1 hover:underline">
            Alle Bundesländer im Überblick <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
