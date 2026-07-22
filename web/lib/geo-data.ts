import type { SupabaseClient } from '@supabase/supabase-js';
import { GolfClub } from './types';
import { BUNDESLAENDER, resolveBundesland } from './regions';
import { distanceKm } from './utils';

const CLUB_FIELDS =
  'id,name,city,region,postal_code,latitude,longitude,logo_url,website,has_9_holes,has_18_holes,courses';

/** Load every club once. Cached by the caller's ISR `revalidate`. */
export async function loadAllClubs(supabase: SupabaseClient): Promise<GolfClub[]> {
  const { data } = await supabase.from('golf_clubs').select(CLUB_FIELDS).order('name');
  return (data ?? []) as unknown as GolfClub[];
}

/** Group already-loaded clubs by canonical Bundesland slug. */
export function groupClubsByBundesland(clubs: GolfClub[]): Map<string, GolfClub[]> {
  const map = new Map<string, GolfClub[]>();
  for (const b of BUNDESLAENDER) map.set(b.slug, []);
  for (const c of clubs) {
    const bl = resolveBundesland(c.region);
    if (bl) map.get(bl.slug)!.push(c);
  }
  return map;
}

/** Convenience: load + group in one call. */
export async function loadClubsByBundesland(
  supabase: SupabaseClient,
): Promise<Map<string, GolfClub[]>> {
  return groupClubsByBundesland(await loadAllClubs(supabase));
}

/** Clubs within `radiusKm` of a point, nearest first. */
export function clubsNearPoint(
  clubs: GolfClub[],
  lat: number,
  lng: number,
  radiusKm: number,
): GolfClub[] {
  return clubs
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({ c, d: distanceKm(lat, lng, c.latitude!, c.longitude!) }))
    .filter((x) => x.d <= radiusKm)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.c);
}

/** Upcoming tournaments for a set of club ids, soonest first. */
export async function loadUpcomingTournaments(
  supabase: SupabaseClient,
  clubIds: string[],
  today: string,
  limit = 150,
) {
  if (clubIds.length === 0) return [];
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .in('club_id', clubIds)
    .gte('date_start', today)
    .order('date_start', { ascending: true })
    .limit(limit);
  return data ?? [];
}

/** Count upcoming tournaments per Bundesland slug (for the /golfturniere index). */
export async function loadUpcomingCountsByBundesland(
  supabase: SupabaseClient,
  clubsByBl: Map<string, GolfClub[]>,
  today: string,
): Promise<Map<string, number>> {
  const clubToBl = new Map<string, string>();
  for (const [slug, clubs] of clubsByBl) {
    for (const c of clubs) clubToBl.set(c.id, slug);
  }

  const { data } = await supabase
    .from('tournaments')
    .select('club_id')
    .gte('date_start', today)
    .not('club_id', 'is', null)
    .limit(20000);

  const counts = new Map<string, number>();
  for (const b of BUNDESLAENDER) counts.set(b.slug, 0);
  for (const row of data ?? []) {
    const slug = clubToBl.get((row as { club_id: string }).club_id);
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}
