import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sparkles, MapPin, Target, Heart, Bookmark, Calendar, History, Home, SlidersHorizontal } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { GolfClub, Profile, Tournament } from '@/lib/types';
import { todayISO, formatDateFull, formatToLabel } from '@/lib/utils';
import { scoreTournaments, tournamentReasons, type ScoredTournament, type ScoringProfile } from '@/lib/recommendations';
import { ExpandableList } from './expandable-list';
import { EmptyState } from '@/components/empty-state';

export const metadata = {
  title: 'Für dich – The Pin',
};

export const revalidate = 300;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function FuerDichPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = todayISO();

  const [{ data: profile }, { data: savedClubRows }, { data: savedTournamentRows }, clubsRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, handicap, home_club_id, recommendation_max_distance, recommendation_prefer_hcp, recommendation_formats')
        .eq('id', user.id)
        .single(),
      supabase.from('saved_clubs').select('club_id').eq('user_id', user.id),
      supabase.from('saved_tournaments').select('tournament_id').eq('user_id', user.id),
      supabase.from('golf_clubs').select('id, name, city, latitude, longitude, region'),
    ]);

  const clubs: Record<string, GolfClub> = {};
  (clubsRes.data ?? []).forEach((c) => {
    clubs[c.id] = c as GolfClub;
  });

  const savedClubIds = new Set<string>((savedClubRows ?? []).map((r) => r.club_id));
  const savedTournamentIds = new Set<string>((savedTournamentRows ?? []).map((r) => r.tournament_id));

  const weekAgoIso = new Date(Date.now() - WEEK_MS).toISOString();

  let query = supabase
    .from('tournaments')
    .select('id, name, date_start, date_end, club_id, format, max_handicap, min_handicap, entry_fee, entry_fee_currency, age_class, gender, description, registration_url, source, source_url, raw_data, rounds')
    .gte('date_start', today)
    .order('date_start', { ascending: true })
    .limit(1000);

  if (profile?.handicap != null) {
    query = query
      .or(`max_handicap.is.null,max_handicap.gte.${profile.handicap}`)
      .or(`min_handicap.is.null,min_handicap.lte.${profile.handicap}`);
  }

  const [{ data: candidateRows }, { data: newRows }, { data: savedUpcomingRows }, { data: savedPastRows }] = await Promise.all([
    query,
    supabase
      .from('tournaments')
      .select('id, name, date_start, date_end, club_id, format, max_handicap, min_handicap, entry_fee, entry_fee_currency, age_class, gender, description, registration_url, source, source_url, raw_data, rounds, created_at')
      .gte('date_start', today)
      .gte('created_at', weekAgoIso)
      .order('date_start', { ascending: true })
      .limit(500),
    savedTournamentIds.size > 0
      ? supabase
          .from('tournaments')
          .select('id, name, date_start, date_end, club_id, format, max_handicap, min_handicap, entry_fee, entry_fee_currency, age_class, gender, description, registration_url, source, source_url, raw_data, rounds')
          .in('id', Array.from(savedTournamentIds))
          .gte('date_start', today)
          .order('date_start', { ascending: true })
      : Promise.resolve({ data: [] }),
    savedTournamentIds.size > 0
      ? supabase
          .from('tournaments')
          .select('id, name, date_start, date_end, club_id, format, max_handicap, min_handicap, entry_fee, entry_fee_currency, age_class, gender, description, registration_url, source, source_url, raw_data, rounds')
          .in('id', Array.from(savedTournamentIds))
          .lt('date_start', today)
          .order('date_start', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
  ]);

  const candidates = (candidateRows ?? []) as Tournament[];
  const scoringProfile = (profile ?? {
    handicap: null,
    home_club_id: null,
    recommendation_max_distance: null,
    recommendation_prefer_hcp: false,
    recommendation_formats: null,
  }) as Profile;
  const scored = scoreTournaments(candidates, scoringProfile, clubs, savedClubIds);

  const savedUpcoming = (savedUpcomingRows ?? []) as Tournament[];
  const savedPast = (savedPastRows ?? []) as Tournament[];
  const newThisWeek = scoreTournaments((newRows ?? []) as Tournament[], scoringProfile, clubs, savedClubIds)
    .filter((t) => t.score > 0)
    .slice(0, 5);

  const notSaved = scored.filter((t) => !savedTournamentIds.has(t.id));
  const maxDist = profile?.recommendation_max_distance ?? 100;

  const nearby = notSaved
    .filter((t) => t.distance < 9999 && t.distance <= maxDist)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);

  const hcpMatch = profile?.handicap != null
    ? notSaved
        .filter((t) => t.max_handicap != null || t.min_handicap != null)
        .slice(0, 6)
    : [];

  const atFavClubs = notSaved
    .filter((t) => t.club_id && (savedClubIds.has(t.club_id) || t.club_id === profile?.home_club_id))
    .slice(0, 6);

  const favClubIds = new Set<string>(savedClubIds);
  if (profile?.home_club_id) favClubIds.add(profile.home_club_id);
  const favClubs = Array.from(favClubIds)
    .map((id) => ({
      id,
      club: clubs[id],
      isHome: id === profile?.home_club_id,
      next: scored.find((t) => t.club_id === id) ?? null,
      upcomingCount: scored.filter((t) => t.club_id === id).length,
    }))
    .filter((c): c is { id: string; club: GolfClub; isHome: boolean; next: ScoredTournament | null; upcomingCount: number } => !!c.club);

  const hasAnyContent =
    newThisWeek.length > 0 ||
    savedUpcoming.length > 0 ||
    nearby.length > 0 ||
    hcpMatch.length > 0 ||
    atFavClubs.length > 0 ||
    favClubs.length > 0 ||
    savedPast.length > 0;

  const hasNew = newThisWeek.length > 0;
  const hasSavedUpcoming = savedUpcoming.length > 0;

  return (
    <div className="py-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-light rounded-lg flex items-center justify-center">
            <Sparkles size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">Für dich</h1>
            <p className="text-sm text-gray-500">Personalisierte Empfehlungen</p>
          </div>
        </div>
        <Link
          href="/profil/einstellungen"
          className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent"
        >
          <SlidersHorizontal size={14} /> Präferenzen
        </Link>
      </div>

      {!profile?.home_club_id && !profile?.handicap && (
        <div className="mb-6 bg-accent-light dark:bg-[#1a2b22] border border-accent/20 rounded-xl p-4">
          <p className="text-sm mb-3">
            Vervollständige dein Profil (Heimatclub, Handicap), damit wir dir bessere Empfehlungen zeigen können.
          </p>
          <Link
            href="/profil/einstellungen"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Profil bearbeiten →
          </Link>
        </div>
      )}

      {/* Top row: Neu diese Woche + Gespeicherte */}
      {(hasNew || hasSavedUpcoming) && (
        <div className={`grid gap-6 mb-8 ${hasNew && hasSavedUpcoming ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>
          {hasNew && (
            <section className={hasSavedUpcoming ? 'lg:col-span-2' : ''}>
              <SectionHeader icon={Sparkles} title="Neu diese Woche" count={newThisWeek.length} />
              <ExpandableList initialCount={3} expandedCount={5} viewMoreHref="/turniere">
                {newThisWeek.map((t) => (
                  <RecommendationRow key={t.id} t={t} clubs={clubs} scoringProfile={scoringProfile} savedClubIds={savedClubIds} />
                ))}
              </ExpandableList>
            </section>
          )}
          {hasSavedUpcoming && (
            <section>
              <SectionHeader icon={Bookmark} title="Gespeichert" count={savedUpcoming.length} />
              <div className="space-y-2">
                {savedUpcoming.slice(0, 6).map((t) => (
                  <RecommendationRow key={t.id} t={t} clubs={clubs} saved scoringProfile={scoringProfile} savedClubIds={savedClubIds} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Favorite clubs strip */}
      {favClubs.length > 0 && (
        <section className="mb-8">
          <SectionHeader icon={Heart} title="Deine Clubs" count={favClubs.length} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {favClubs.map(({ id, club, isHome, next, upcomingCount }) => (
              <Link
                key={id}
                href={`/clubs/${id}`}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-accent/30 transition-all"
              >
                <div className="flex items-start gap-2">
                  {isHome ? (
                    <Home size={14} className="text-accent shrink-0 mt-0.5" />
                  ) : (
                    <Heart size={14} className="text-pink-500 shrink-0 mt-0.5" fill="currentColor" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{club.name}</div>
                    <div className="text-xs text-gray-400 truncate">{club.city}</div>
                  </div>
                </div>
                {next ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-accent font-medium">
                        {formatDateFull(next.date_start)}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">{next.name}</div>
                    </div>
                    {upcomingCount > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-accent-light text-accent rounded font-medium shrink-0">
                        +{upcomingCount - 1}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-[11px] text-gray-400">Keine kommenden Turniere</div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Category clusters */}
      {(nearby.length > 0 || hcpMatch.length > 0 || atFavClubs.length > 0) && (
        <section className="mb-8">
          <SectionHeader icon={Target} title="Warum für dich?" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearby.length > 0 && (
              <Cluster
                title="In deiner Nähe"
                subtitle={`Bis ${maxDist} km vom Heimatclub`}
                icon={MapPin}
                items={nearby}
                clubs={clubs}
                tone="blue"
              />
            )}
            {hcpMatch.length > 0 && (
              <Cluster
                title="Passend zum HCP"
                subtitle={profile?.handicap != null ? `Für Handicap ${profile.handicap}` : undefined}
                icon={Target}
                items={hcpMatch}
                clubs={clubs}
                tone="green"
              />
            )}
            {atFavClubs.length > 0 && (
              <Cluster
                title="Bei deinen Clubs"
                subtitle="Heimatclub & Lieblingsclubs"
                icon={Heart}
                items={atFavClubs}
                clubs={clubs}
                tone="pink"
              />
            )}
          </div>
        </section>
      )}

      {/* Past tournaments */}
      {savedPast.length > 0 && (
        <section className="mb-8">
          <SectionHeader icon={History} title="Vergangene Turniere" count={savedPast.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {savedPast.map((t) => (
              <RecommendationRow key={t.id} t={t} clubs={clubs} past />
            ))}
          </div>
        </section>
      )}

      {!hasAnyContent && (
        <EmptyState
          icon={MapPin}
          title="Noch keine Empfehlungen"
          description="Setze deinen Heimatclub und dein Handicap in den Einstellungen, damit wir dir passende Turniere zeigen können."
          action={{ label: 'Profil einrichten', href: '/profil/einstellungen' }}
        />
      )}

      <div className="mt-8 flex gap-3 justify-center text-sm text-gray-500">
        <Link href="/turniere" className="flex items-center gap-1 hover:text-accent">
          <Calendar size={14} /> Alle Turniere
        </Link>
        <span className="sm:hidden">·</span>
        <Link href="/profil/einstellungen" className="sm:hidden flex items-center gap-1 hover:text-accent">
          <SlidersHorizontal size={14} /> Präferenzen
        </Link>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  count,
}: {
  title: string;
  icon: typeof Sparkles;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-accent" />
      <h2 className="text-base font-bold">{title}</h2>
      {count != null && <span className="text-xs text-gray-400">({count})</span>}
    </div>
  );
}

const CLUSTER_TONES = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  green: { bg: 'bg-accent-light', text: 'text-accent', border: 'border-accent/20' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-100' },
} as const;

function Cluster({
  title,
  subtitle,
  icon: Icon,
  items,
  clubs,
  tone,
}: {
  title: string;
  subtitle?: string;
  icon: typeof Sparkles;
  items: ScoredTournament[];
  clubs: Record<string, GolfClub>;
  tone: keyof typeof CLUSTER_TONES;
}) {
  const c = CLUSTER_TONES[tone];
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className={`${c.bg} ${c.border} border-b px-4 py-3`}>
        <div className="flex items-center gap-2">
          <Icon size={14} className={c.text} />
          <div className="text-sm font-bold">{title}</div>
          <span className="ml-auto text-xs text-gray-500">{items.length}</span>
        </div>
        {subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
      <div className="p-2 flex-1 flex flex-col gap-0.5">
        {items.map((item) => (
          <ClusterRow key={item.id} t={item} clubs={clubs} toneText={c.text} />
        ))}
      </div>
    </div>
  );
}

function ClusterRow({
  t,
  clubs,
  toneText,
}: {
  t: ScoredTournament;
  clubs: Record<string, GolfClub>;
  toneText: string;
}) {
  const club = clubs[t.club_id || ''];
  const date = new Date(t.date_start + 'T00:00:00');
  return (
    <Link
      href={`/turniere/${t.id}`}
      prefetch={false}
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
    >
      <div className="shrink-0 w-10 h-10 bg-accent-light rounded-lg flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-accent leading-none">{date.getDate()}</span>
        <span className="text-[9px] text-accent font-medium uppercase">
          {date.toLocaleDateString('de-DE', { month: 'short' })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate">{t.name}</div>
        <div className="text-[11px] text-gray-400 truncate">{club?.name}</div>
      </div>
      {t.distance < 9999 && (
        <span className={`text-[10px] ${toneText} font-semibold shrink-0 whitespace-nowrap`}>
          {t.distance < 1 ? `${Math.round(t.distance * 1000)} m` : `${t.distance.toFixed(0)} km`}
        </span>
      )}
    </Link>
  );
}

function RecommendationRow({
  t,
  clubs,
  saved = false,
  past = false,
  scoringProfile,
  savedClubIds,
}: {
  t: ScoredTournament | Tournament;
  clubs: Record<string, GolfClub>;
  saved?: boolean;
  past?: boolean;
  scoringProfile?: ScoringProfile;
  savedClubIds?: Set<string>;
}) {
  const club = clubs[t.club_id || ''];
  const formatLabel = formatToLabel(t.format);
  const dist = 'distance' in t ? t.distance : undefined;
  const date = new Date(t.date_start + 'T00:00:00');

  const reasons =
    scoringProfile && savedClubIds && !past
      ? tournamentReasons(t, scoringProfile, savedClubIds)
      : null;

  return (
    <Link
      href={`/turniere/${t.id}`}
      prefetch={false}
      className={`flex items-center gap-3 bg-white border rounded-xl p-3.5 transition-shadow ${
        past ? 'border-gray-100 opacity-75 hover:opacity-100' : 'border-gray-200 hover:shadow-sm'
      }`}
    >
      <div
        className={`shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
          past ? 'bg-gray-100' : 'bg-accent-light'
        }`}
      >
        <span className={`text-base font-bold leading-none ${past ? 'text-gray-500' : 'text-accent'}`}>
          {date.getDate()}
        </span>
        <span className={`text-[10px] font-medium uppercase ${past ? 'text-gray-400' : 'text-accent'}`}>
          {date.toLocaleDateString('de-DE', { month: 'short' })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm leading-snug truncate">{t.name}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">
          {club?.name}
          {club?.city ? ` · ${club.city}` : ''}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {dist != null && dist < 9999 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
              {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(0)} km`}
            </span>
          )}
          {reasons?.favoriteClub === 'home' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-accent-light text-accent rounded font-medium">
              Heimatclub
            </span>
          )}
          {reasons?.favoriteClub === 'favorite' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded font-medium">
              Lieblingsclub
            </span>
          )}
          {reasons?.hcpMatch && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium dark:bg-[#152a1a] dark:text-[#4ead6e]">
              passt zu HCP
            </span>
          )}
          {reasons?.formatMatch && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium dark:bg-[#2a2410] dark:text-[#e8c84a]">
              dein Format
            </span>
          )}
          {formatLabel && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
              {formatLabel}
            </span>
          )}
          {saved && !past && (
            <span className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded font-medium">
              Gespeichert
            </span>
          )}
          {past && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
              Vergangen
            </span>
          )}
        </div>
      </div>
      {!past && (
        <div className="shrink-0 text-xs font-medium text-accent whitespace-nowrap">
          {formatDateFull(t.date_start)}
        </div>
      )}
    </Link>
  );
}
