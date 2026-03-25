import Link from 'next/link';
import { Calendar, Building2, Map, Sparkles, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { GolfClub, Tournament, Profile } from '@/lib/types';
import { todayISO, formatDateFull, formatToLabel, distanceKm } from '@/lib/utils';

export const revalidate = 3600;

async function getData() {
  const supabase = await createClient();
  const today = todayISO();

  // Fetch counts + clubs + user in parallel — no need to fetch all tournaments for counts
  const [countRes, clubsRes, userRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .gte('date_start', today),
    supabase
      .from('golf_clubs')
      .select('id, name, city, latitude, longitude'),
    supabase.auth.getUser(),
  ]);

  const tournamentCount = countRes.count ?? 0;
  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  const user = userRes.data?.user;
  let forYou: (Tournament & { distance?: number })[] = [];

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('handicap, home_club_id')
      .eq('id', user.id)
      .single();

    if (profile) {
      const p = profile as Pick<Profile, 'handicap' | 'home_club_id'>;
      const homeClub = p.home_club_id ? clubs[p.home_club_id] : null;
      const hasHomeCoords = homeClub?.latitude && homeClub?.longitude;

      // Only fetch the columns we need for "Für dich", limited set
      let query = supabase
        .from('tournaments')
        .select('id, name, date_start, club_id, format, max_handicap, min_handicap')
        .gte('date_start', today)
        .order('date_start', { ascending: true });

      // Apply HCP filter at DB level if possible
      if (p.handicap != null) {
        query = query.or(`max_handicap.is.null,max_handicap.gte.${p.handicap}`);
        query = query.or(`min_handicap.is.null,min_handicap.lte.${p.handicap}`);
      }

      // If no home club coords, just take first 4
      if (!hasHomeCoords) {
        query = query.limit(4);
      }

      const { data: candidates } = await query;
      const tournamentList = (candidates ?? []) as Tournament[];

      if (hasHomeCoords) {
        const withDist = tournamentList.map((t) => {
          const club = clubs[t.club_id || ''];
          const dist =
            club?.latitude && club?.longitude
              ? distanceKm(homeClub.latitude!, homeClub.longitude!, club.latitude, club.longitude)
              : 9999;
          return { ...t, distance: dist };
        });
        withDist.sort((a, b) => a.distance - b.distance);
        forYou = withDist.slice(0, 4);
      } else {
        forYou = tournamentList;
      }
    }
  }

  return {
    tournamentCount,
    clubCount: Object.keys(clubs).length,
    clubs,
    forYou,
    isLoggedIn: !!user,
  };
}

export default async function HomePage() {
  const { tournamentCount, clubCount, clubs, forYou, isLoggedIn } = await getData();

  return (
    <div className="py-5">
      {/* Hero */}
      <div className="flex items-center gap-3 mb-5">
        <img src="/logo.png" alt="The Pin" width={50} height={50} className="rounded" />
        <div>
          <p className="text-sm text-gray-800">Deine App für Golfturniere in Bayern (und bald ganz Deutschland)</p>
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

      {/* For You — logged in */}
      {isLoggedIn && forYou.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-base font-bold">Für dich</h2>
            <p className="text-xs text-gray-800 mt-0.5">Vorgeschlagene Turniere in der Nähe von dir, oder deines Heimatclubs</p>
          </div>

          <div className="space-y-2">
            {forYou.map((t) => {
              const club = clubs[t.club_id || ''];
              const formatLabel = formatToLabel(t.format);
              const dist = t.distance;
              return (
                <Link
                  key={t.id}
                  href={`/turniere/${t.id}`}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 hover:shadow-sm transition-shadow"
                >
                  <div className="shrink-0 w-12 h-12 bg-accent-light rounded-lg flex flex-col items-center justify-center">
                    <span className="text-base font-bold text-accent leading-none">
                      {new Date(t.date_start + 'T00:00:00').getDate()}
                    </span>
                    <span className="text-[10px] text-accent font-medium uppercase">
                      {new Date(t.date_start + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm leading-snug truncate">{t.name}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      {club?.name}{club?.city ? ` · ${club.city}` : ''}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {formatLabel && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent-light text-accent rounded font-medium">
                          {formatLabel}
                        </span>
                      )}
                      {dist != null && dist < 9999 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded font-medium">
                          {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(0)} km`}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <Link
            href="/turniere"
            className="block text-center text-sm text-accent hover:underline font-medium mt-3"
          >
            Alle Turniere ansehen →
          </Link>
        </div>
      )}

      {/* For You CTA — not logged in */}
      {!isLoggedIn && (
        <div className="mb-8 bg-accent-light border border-accent/20 rounded-xl p-5 text-center">
          <Sparkles size={20} className="text-accent mx-auto mb-2" />
          <h2 className="text-base font-bold mb-1">Für dich</h2>
          <p className="text-sm text-gray-600 mb-4">
            Erstelle einen Account um für dich passende Turniere zu finden
          </p>
          <Link
            href="/registrieren"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <UserPlus size={16} />
            Kostenlos registrieren
          </Link>
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
