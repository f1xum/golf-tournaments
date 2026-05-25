import type { GolfClub, Profile, Tournament } from './types';
import { distanceKm } from './utils';

export type ScoringProfile = Pick<
  Profile,
  | 'handicap'
  | 'home_club_id'
  | 'recommendation_max_distance'
  | 'recommendation_prefer_hcp'
  | 'recommendation_formats'
>;

export interface ScoredTournament extends Tournament {
  distance: number;
  score: number;
}

export interface RecommendationReasons {
  hcpMatch: boolean;
  favoriteClub: 'home' | 'favorite' | null;
  formatMatch: boolean;
}

/**
 * Mirror the signals that drive scoreTournaments(), so the UI can label *why*
 * a tournament is recommended. Pure derivation — no extra fetches.
 */
export function tournamentReasons(
  t: Tournament,
  profile: ScoringProfile,
  savedClubIds: Set<string>,
): RecommendationReasons {
  const raw = t.raw_data || {};
  const hcpMatch = !!(profile.recommendation_prefer_hcp && raw.hcp_relevant);

  let favoriteClub: 'home' | 'favorite' | null = null;
  if (t.club_id) {
    if (t.club_id === profile.home_club_id) favoriteClub = 'home';
    else if (savedClubIds.has(t.club_id)) favoriteClub = 'favorite';
  }

  const formatMatch = !!(
    profile.recommendation_formats &&
    profile.recommendation_formats.length > 0 &&
    t.format &&
    profile.recommendation_formats.includes(t.format)
  );

  return { hcpMatch, favoriteClub, formatMatch };
}

export function scoreTournaments(
  tournaments: Tournament[],
  profile: ScoringProfile,
  clubs: Record<string, GolfClub>,
  savedClubIds: Set<string>
): ScoredTournament[] {
  const homeClub = profile.home_club_id ? clubs[profile.home_club_id] : null;
  const hasHomeCoords = !!(homeClub?.latitude && homeClub?.longitude);
  const maxDistPref = profile.recommendation_max_distance;
  const preferHcp = profile.recommendation_prefer_hcp;
  const prefFormats = profile.recommendation_formats;

  return tournaments.map((t) => {
    const club = clubs[t.club_id || ''];
    let score = 0;
    let dist = 9999;

    if (hasHomeCoords && club?.latitude && club?.longitude) {
      dist = distanceKm(homeClub.latitude!, homeClub.longitude!, club.latitude, club.longitude);
      if (dist <= 25) score += 40;
      else if (dist <= 50) score += 30;
      else if (dist <= 100) score += 20;
      else if (dist <= 200) score += 10;
    }

    if (maxDistPref && dist > maxDistPref) score -= 100;

    if (t.club_id && savedClubIds.has(t.club_id)) score += 30;
    if (t.club_id && t.club_id === profile.home_club_id) score += 25;

    const raw = t.raw_data || {};
    if (typeof raw.free_slots === 'number' && raw.free_slots > 0) score += 10;
    if (preferHcp && raw.hcp_relevant) score += 20;
    if (prefFormats && prefFormats.length > 0 && t.format && prefFormats.includes(t.format)) {
      score += 15;
    }

    const daysAway = (new Date(t.date_start).getTime() - Date.now()) / 86400000;
    if (daysAway <= 14) score += 10;
    else if (daysAway <= 30) score += 5;

    return { ...t, distance: dist, score };
  }).sort((a, b) => b.score - a.score || a.distance - b.distance);
}
