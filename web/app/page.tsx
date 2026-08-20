import Link from 'next/link';
import { Calendar, Building2, Map, Sparkles, UserPlus, MapPin, Target, Heart, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils';
import { BUNDESLAENDER } from '@/lib/regions';

export const revalidate = 3600;

async function getData() {
  const supabase = await createClient();
  const today = todayISO();

  const [countRes, clubCountRes, userRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .gte('date_start', today),
    supabase
      .from('golf_clubs')
      .select('id', { count: 'exact', head: true })
      // Headline count should match what /clubs actually lists.
      .is('merged_into', null),
    supabase.auth.getUser(),
  ]);

  return {
    tournamentCount: countRes.count ?? 0,
    clubCount: clubCountRes.count ?? 0,
    isLoggedIn: !!userRes.data?.user,
  };
}

export default async function HomePage() {
  const { tournamentCount, clubCount, isLoggedIn } = await getData();

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

      {/* For You CTA — logged in */}
      {isLoggedIn && (
        <Link
          href="/fuer-dich"
          className="group block mb-8 bg-accent text-white rounded-xl p-5 shadow-sm hover:shadow-md hover:bg-accent/95 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base leading-snug">
                Zeig mir meine personalisierten Turniere
              </div>
              <div className="text-sm text-white/80 mt-0.5">
                Empfehlungen basierend auf deinem Profil
              </div>
            </div>
            <ArrowRight size={20} className="text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </Link>
      )}

      {/* For You CTA — not logged in */}
      {!isLoggedIn && (
        <div className="mb-8 bg-accent-light dark:bg-[#1a2b22] border border-accent/20 dark:border-[#2d4a3a] rounded-xl p-6">
          <div className="text-center mb-4">
            <Sparkles size={22} className="text-accent mx-auto mb-2" />
            <h2 className="text-lg font-bold mb-1">Golfturniere, die zu dir passen</h2>
            <p className="text-sm text-gray-600 dark:text-[#b8b8b8]">
              Für dich personalisierte Empfehlungen basierend auf deinem Profil
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5 text-left">
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <MapPin size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">In deiner Nähe</div>
                <div className="text-[11px] text-gray-500">Turniere rund um deinen Heimatclub</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <Target size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Passend zu deinem HCP</div>
                <div className="text-[11px] text-gray-500">Nur Turniere, die du spielen kannst</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <Heart size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Deine Lieblingsclubs</div>
                <div className="text-[11px] text-gray-500">Turniere bei Clubs, die du liebst</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <SlidersHorizontal size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Deine Spielformen</div>
                <div className="text-[11px] text-gray-500">Stableford, Scramble & mehr</div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/registrieren"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              <UserPlus size={16} />
              Kostenlos registrieren
            </Link>
          </div>
        </div>
      )}

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
