import Link from 'next/link';
import { Calendar, Building2, Map, Sparkles, UserPlus, MapPin, Target, Heart, SlidersHorizontal } from 'lucide-react';
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
    const [{ data: profile }, { data: savedClubs }] = await Promise.all([
      supabase
        .from('profiles')
        .select('handicap, home_club_id, recommendation_max_distance, recommendation_prefer_hcp, recommendation_formats')
        .eq('id', user.id)
        .single(),
      supabase
        .from('saved_clubs')
        .select('club_id')
        .eq('user_id', user.id),
    ]);

    if (profile) {
      const p = profile as Pick<Profile, 'handicap' | 'home_club_id' | 'recommendation_max_distance' | 'recommendation_prefer_hcp' | 'recommendation_formats'>;
      const homeClub = p.home_club_id ? clubs[p.home_club_id] : null;
      const hasHomeCoords = homeClub?.latitude && homeClub?.longitude;
      const savedClubIds = new Set((savedClubs ?? []).map((r) => r.club_id));

      // Fetch upcoming tournaments for recommendations
      let query = supabase
        .from('tournaments')
        .select('id, name, date_start, club_id, format, max_handicap, min_handicap, entry_fee, raw_data')
        .gte('date_start', today)
        .order('date_start', { ascending: true });

      // Apply HCP filter at DB level
      if (p.handicap != null) {
        query = query.or(`max_handicap.is.null,max_handicap.gte.${p.handicap}`);
        query = query.or(`min_handicap.is.null,min_handicap.lte.${p.handicap}`);
      }

      // Limit candidates — we only need the top 4, so 500 nearest-date is plenty
      query = query.limit(500);

      const { data: candidates } = await query;
      const tournamentList = (candidates ?? []) as Tournament[];

      // Score each tournament for relevance using user preferences
      const maxDistPref = p.recommendation_max_distance;
      const preferHcp = p.recommendation_prefer_hcp;
      const prefFormats = p.recommendation_formats;

      const scored = tournamentList.map((t) => {
        const club = clubs[t.club_id || ''];
        let score = 0;

        // Distance from home club (closer = better)
        let dist = 9999;
        if (hasHomeCoords && club?.latitude && club?.longitude) {
          dist = distanceKm(homeClub.latitude!, homeClub.longitude!, club.latitude, club.longitude);
          if (dist <= 25) score += 40;
          else if (dist <= 50) score += 30;
          else if (dist <= 100) score += 20;
          else if (dist <= 200) score += 10;
        }

        // Filter by max distance preference
        if (maxDistPref && dist > maxDistPref) score -= 100;

        // Favorite club boost
        if (t.club_id && savedClubIds.has(t.club_id)) score += 30;

        // Home club boost
        if (t.club_id && t.club_id === p.home_club_id) score += 25;

        // Has free slots (still open)
        const raw = t.raw_data || {};
        if (typeof raw.free_slots === 'number' && raw.free_slots > 0) score += 10;

        // HCP-relevant preference
        if (preferHcp && raw.hcp_relevant) score += 20;

        // Preferred format boost
        if (prefFormats && prefFormats.length > 0 && t.format) {
          if (prefFormats.includes(t.format)) score += 15;
        }

        // Sooner tournaments get a small boost (within 2 weeks)
        const daysAway = (new Date(t.date_start).getTime() - Date.now()) / 86400000;
        if (daysAway <= 14) score += 10;
        else if (daysAway <= 30) score += 5;

        return { ...t, distance: dist, score };
      });

      scored.sort((a, b) => b.score - a.score || a.distance - b.distance);
      forYou = scored.slice(0, 4);
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

      {/* For You — logged in */}
      {isLoggedIn && forYou.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-base font-bold">Turniere für dich</h2>
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
    </div>
  );
}
