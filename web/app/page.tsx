import Link from 'next/link';
import { Calendar, Building2, Map, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { GolfClub, Tournament, Profile } from '@/lib/types';
import { todayISO, formatDateFull, formatToLabel } from '@/lib/utils';

export const revalidate = 3600;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getData() {
  const supabase = await createClient();
  const today = todayISO();

  const [tournamentsRes, clubsRes, userRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*')
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(5000),
    supabase
      .from('golf_clubs')
      .select('id, name, city, latitude, longitude'),
    supabase.auth.getUser(),
  ]);

  const tournaments = (tournamentsRes.data ?? []) as Tournament[];
  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  const user = userRes.data?.user;
  let forYou: (Tournament & { distance?: number })[] = [];

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      const p = profile as Profile;
      const homeClub = p.home_club_id ? clubs[p.home_club_id] : null;
      const hasHomeCoords = homeClub?.latitude && homeClub?.longitude;

      // Filter by HCP match
      let candidates = tournaments.filter((t) => {
        if (p.handicap != null) {
          if (t.max_handicap != null && p.handicap > t.max_handicap) return false;
          if (t.min_handicap != null && p.handicap < t.min_handicap) return false;
        }
        return true;
      });

      // Add distance and sort by it if home club has coordinates
      if (hasHomeCoords) {
        const withDist = candidates.map((t) => {
          const club = clubs[t.club_id || ''];
          const dist =
            club?.latitude && club?.longitude
              ? distanceKm(homeClub.latitude!, homeClub.longitude!, club.latitude, club.longitude)
              : 9999;
          return { ...t, distance: dist };
        });
        withDist.sort((a, b) => a.distance - b.distance);
        forYou = withDist.slice(0, 8);
      } else {
        forYou = candidates.slice(0, 8);
      }
    }
  }

  return {
    tournamentCount: tournaments.length,
    clubCount: Object.keys(clubs).length,
    clubs,
    forYou,
    isLoggedIn: !!user,
  };
}

export default async function HomePage() {
  const { tournamentCount, clubCount, clubs, forYou, isLoggedIn } = await getData();

  return (
    <div className="py-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          The Pin
        </h1>
        <p className="text-gray-500 text-lg">
          Finde und speichere Golfturniere in Bayern
        </p>
      </div>

      {/* For You */}
      {isLoggedIn && forYou.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-accent" />
            <h2 className="text-lg font-bold">Für dich</h2>
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
                  {/* Date badge */}
                  <div className="shrink-0 w-12 h-12 bg-accent-light rounded-lg flex flex-col items-center justify-center">
                    <span className="text-base font-bold text-accent leading-none">
                      {new Date(t.date_start + 'T00:00:00').getDate()}
                    </span>
                    <span className="text-[10px] text-accent font-medium uppercase">
                      {new Date(t.date_start + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
                    </span>
                  </div>

                  {/* Info */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-accent">{tournamentCount}</div>
          <div className="text-sm text-gray-500 mt-1">Kommende Turniere</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-accent">{clubCount}</div>
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
