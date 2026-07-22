// Canonical German Bundesländer for SEO geo hub pages (/golfturniere/[bundesland]).
//
// The `region` column on golf_clubs is messy: it mixes Bundesländer ("Bayern"),
// Regierungsbezirke ("Oberbayern", "Schwaben", …) and even city names ("München").
// This module normalises all of that to the 16 official Bundesländer so a page like
// "Golfturniere in Bayern" captures *every* Bavarian club, not just those literally
// tagged "Bayern".

export interface Bundesland {
  slug: string;
  name: string;
  /**
   * City-states (Berlin, Hamburg, Bremen) are tiny administratively but the search
   * intent is metro-wide. When set, the hub page selects clubs by radius around this
   * centre instead of by region tag — capturing far more clubs.
   */
  center?: { lat: number; lng: number; radiusKm: number };
}

export const BUNDESLAENDER: Bundesland[] = [
  { slug: 'baden-wuerttemberg', name: 'Baden-Württemberg' },
  { slug: 'bayern', name: 'Bayern' },
  { slug: 'berlin', name: 'Berlin', center: { lat: 52.52, lng: 13.405, radiusKm: 40 } },
  { slug: 'brandenburg', name: 'Brandenburg' },
  { slug: 'bremen', name: 'Bremen', center: { lat: 53.0793, lng: 8.8017, radiusKm: 35 } },
  { slug: 'hamburg', name: 'Hamburg', center: { lat: 53.5511, lng: 9.9937, radiusKm: 35 } },
  { slug: 'hessen', name: 'Hessen' },
  { slug: 'mecklenburg-vorpommern', name: 'Mecklenburg-Vorpommern' },
  { slug: 'niedersachsen', name: 'Niedersachsen' },
  { slug: 'nordrhein-westfalen', name: 'Nordrhein-Westfalen' },
  { slug: 'rheinland-pfalz', name: 'Rheinland-Pfalz' },
  { slug: 'saarland', name: 'Saarland' },
  { slug: 'sachsen', name: 'Sachsen' },
  { slug: 'sachsen-anhalt', name: 'Sachsen-Anhalt' },
  { slug: 'schleswig-holstein', name: 'Schleswig-Holstein' },
  { slug: 'thueringen', name: 'Thüringen' },
];

const SLUG_TO_BL = new Map(BUNDESLAENDER.map((b) => [b.slug, b]));
const NAME_TO_BL = new Map(BUNDESLAENDER.map((b) => [b.name.toLowerCase(), b]));

// Raw region values that are NOT already a Bundesland name → the Bundesland they belong to.
// Mostly Bavarian Regierungsbezirke plus a stray "München".
const RAW_REGION_ALIASES: Record<string, string> = {
  oberbayern: 'Bayern',
  niederbayern: 'Bayern',
  schwaben: 'Bayern',
  oberpfalz: 'Bayern',
  oberfranken: 'Bayern',
  mittelfranken: 'Bayern',
  unterfranken: 'Bayern',
  münchen: 'Bayern',
  muenchen: 'Bayern',
};

export function bundeslandBySlug(slug: string): Bundesland | null {
  return SLUG_TO_BL.get(slug) ?? null;
}

/**
 * Normalise a raw club `region` (plus tournament `source` as a fallback) to a
 * canonical Bundesland. Returns null when it can't be resolved.
 */
export function resolveBundesland(
  region: string | null | undefined,
  source?: string | null,
): Bundesland | null {
  if (region) {
    const key = region.trim().toLowerCase();
    const direct = NAME_TO_BL.get(key);
    if (direct) return direct;
    const aliased = RAW_REGION_ALIASES[key];
    if (aliased) return NAME_TO_BL.get(aliased.toLowerCase()) ?? null;
  }
  // BGV-sourced tournaments are Bavarian by definition when region is missing.
  if (source === 'bgv') return NAME_TO_BL.get('bayern') ?? null;
  return null;
}
