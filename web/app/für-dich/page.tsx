import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sparkles, MapPin, Target, Heart, Bookmark, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { GolfClub, Profile, Tournament } from '@/lib/types';
import { todayISO, formatDateFull, formatToLabel } from '@/lib/utils';
import { scoreTournaments, type ScoredTournament } from '@/lib/recommendations';

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

  const [{ data: candidateRows }, { data: newRows }, { data: savedUpcomingRows }] = await Promise.all([
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
  const newThisWeek = scoreTournaments((newRows ?? []) as Tournament[], scoringProfile, clubs, savedClubIds)
    .filter((t) => t.score > 0)
    .slice(0, 12);

  const moreRecommendations = scored
    .filter((t) => !savedTournamentIds.has(t.id) && !newThisWeek.some((n) => n.id === t.id))
    .slice(0, 20);

  return (
    <div className="py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles size={20} className="text-accent" />
        <h1 className="text-2xl font-bold">Für dich</h1>
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

      {newThisWeek.length > 0 && (
        <Section title="Neu diese Woche" icon={Sparkles} count={newThisWeek.length}>
          {newThisWeek.map((t) => (
            <RecommendationRow key={t.id} t={t} clubs={clubs} />
          ))}
        </Section>
      )}

      {savedUpcoming.length > 0 && (
        <Section title="Deine gespeicherten Turniere" icon={Bookmark} count={savedUpcoming.length}>
          {savedUpcoming.map((t) => (
            <RecommendationRow key={t.id} t={t} clubs={clubs} saved />
          ))}
        </Section>
      )}

      {moreRecommendations.length > 0 && (
        <Section title="Weitere Empfehlungen" icon={Target} count={moreRecommendations.length}>
          {moreRecommendations.map((t) => (
            <RecommendationRow key={t.id} t={t} clubs={clubs} />
          ))}
        </Section>
      )}

      {newThisWeek.length === 0 && savedUpcoming.length === 0 && moreRecommendations.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <MapPin size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 mb-3">Noch keine Empfehlungen.</p>
          <p className="text-xs text-gray-400 mb-4">
            Setze deinen Heimatclub und dein Handicap in den Einstellungen, damit wir dir passende Turniere zeigen können.
          </p>
          <Link
            href="/profil/einstellungen"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Profil einrichten →
          </Link>
        </div>
      )}

      <div className="mt-8 flex gap-3 justify-center text-sm text-gray-500">
        <Link href="/turniere" className="flex items-center gap-1 hover:text-accent">
          <Calendar size={14} /> Alle Turniere
        </Link>
        <span>·</span>
        <Link href="/profil/einstellungen" className="flex items-center gap-1 hover:text-accent">
          <Heart size={14} /> Präferenzen
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-accent" />
        <h2 className="text-base font-bold">{title}</h2>
        <span className="text-xs text-gray-400">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function RecommendationRow({
  t,
  clubs,
  saved = false,
}: {
  t: ScoredTournament | Tournament;
  clubs: Record<string, GolfClub>;
  saved?: boolean;
}) {
  const club = clubs[t.club_id || ''];
  const formatLabel = formatToLabel(t.format);
  const dist = 'distance' in t ? t.distance : undefined;
  const date = new Date(t.date_start + 'T00:00:00');

  return (
    <Link
      href={`/turniere/${t.id}`}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 hover:shadow-sm transition-shadow"
    >
      <div className="shrink-0 w-12 h-12 bg-accent-light rounded-lg flex flex-col items-center justify-center">
        <span className="text-base font-bold text-accent leading-none">{date.getDate()}</span>
        <span className="text-[10px] text-accent font-medium uppercase">
          {date.toLocaleDateString('de-DE', { month: 'short' })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm leading-snug truncate">{t.name}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">
          {club?.name}
          {club?.city ? ` · ${club.city}` : ''}
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
          {saved && (
            <span className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-500 rounded font-medium">
              Gespeichert
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-xs font-medium text-accent whitespace-nowrap">
        {formatDateFull(t.date_start)}
      </div>
    </Link>
  );
}
