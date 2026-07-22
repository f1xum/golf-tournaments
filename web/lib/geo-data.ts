import type { SupabaseClient } from '@supabase/supabase-js';
import { GolfClub } from './types';
import { BUNDESLAENDER, resolveBundesland } from './regions';

const CLUB_FIELDS =
  'id,name,city,region,postal_code,latitude,longitude,logo_url,website,has_9_holes,has_18_holes,courses';

/**
 * Load every club grouped by canonical Bundesland slug. One query, cached by the
 * caller's ISR `revalidate`. Clubs whose region can't be resolved are dropped.
 */
export async function loadClubsByBundesland(
  supabase: SupabaseClient,
): Promise<Map<string, GolfClub[]>> {
  const { data } = await supabase.from('golf_clubs').select(CLUB_FIELDS).order('name');

  const map = new Map<string, GolfClub[]>();
  for (const b of BUNDESLAENDER) map.set(b.slug, []);

  for (const row of data ?? []) {
    const bl = resolveBundesland((row as { region: string | null }).region);
    if (bl) map.get(bl.slug)!.push(row as unknown as GolfClub);
  }
  return map;
}

/** Count upcoming tournaments per Bundesland slug (for the /golfturniere index). */
export async function loadUpcomingCountsByBundesland(
  supabase: SupabaseClient,
  clubsByBl: Map<string, GolfClub[]>,
  today: string,
): Promise<Map<string, number>> {
  // Map every club id → its Bundesland slug.
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
