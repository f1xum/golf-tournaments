// Major German cities for metro-level SEO pages (/golfturniere/stadt/[stadt]).
//
// These are RADIUS pages: we select every club within `radiusKm` of the city
// centre, because clubs around a big city are tagged with suburb names
// (e.g. Munich-area clubs sit in Aschheim, Eschenried, Starnberg…), so matching
// on club.city would miss the real "golfturniere münchen" intent.

export interface City {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  /** Bundesland slug this city sits in — used for cross-linking. */
  bundesland: string;
}

export const CITIES: City[] = [
  // Bayern
  { slug: 'muenchen', name: 'München', lat: 48.1351, lng: 11.582, radiusKm: 30, bundesland: 'bayern' },
  { slug: 'nuernberg', name: 'Nürnberg', lat: 49.4521, lng: 11.0767, radiusKm: 30, bundesland: 'bayern' },
  { slug: 'augsburg', name: 'Augsburg', lat: 48.3705, lng: 10.8978, radiusKm: 30, bundesland: 'bayern' },
  { slug: 'regensburg', name: 'Regensburg', lat: 49.0134, lng: 12.1016, radiusKm: 40, bundesland: 'bayern' },
  { slug: 'ingolstadt', name: 'Ingolstadt', lat: 48.7665, lng: 11.4258, radiusKm: 30, bundesland: 'bayern' },
  // Nordrhein-Westfalen
  { slug: 'koeln', name: 'Köln', lat: 50.9375, lng: 6.9603, radiusKm: 30, bundesland: 'nordrhein-westfalen' },
  { slug: 'duesseldorf', name: 'Düsseldorf', lat: 51.2277, lng: 6.7735, radiusKm: 25, bundesland: 'nordrhein-westfalen' },
  { slug: 'essen', name: 'Essen', lat: 51.4556, lng: 7.0116, radiusKm: 20, bundesland: 'nordrhein-westfalen' },
  { slug: 'dortmund', name: 'Dortmund', lat: 51.5136, lng: 7.4653, radiusKm: 20, bundesland: 'nordrhein-westfalen' },
  { slug: 'bonn', name: 'Bonn', lat: 50.7374, lng: 7.0982, radiusKm: 25, bundesland: 'nordrhein-westfalen' },
  { slug: 'muenster', name: 'Münster', lat: 51.9607, lng: 7.6261, radiusKm: 30, bundesland: 'nordrhein-westfalen' },
  { slug: 'bielefeld', name: 'Bielefeld', lat: 52.0302, lng: 8.5325, radiusKm: 30, bundesland: 'nordrhein-westfalen' },
  // Hessen
  { slug: 'frankfurt', name: 'Frankfurt am Main', lat: 50.1109, lng: 8.6821, radiusKm: 30, bundesland: 'hessen' },
  { slug: 'wiesbaden', name: 'Wiesbaden', lat: 50.0782, lng: 8.2398, radiusKm: 20, bundesland: 'hessen' },
  // Baden-Württemberg
  { slug: 'stuttgart', name: 'Stuttgart', lat: 48.7758, lng: 9.1829, radiusKm: 30, bundesland: 'baden-wuerttemberg' },
  { slug: 'karlsruhe', name: 'Karlsruhe', lat: 49.0069, lng: 8.4037, radiusKm: 30, bundesland: 'baden-wuerttemberg' },
  { slug: 'mannheim', name: 'Mannheim', lat: 49.4875, lng: 8.466, radiusKm: 25, bundesland: 'baden-wuerttemberg' },
  { slug: 'freiburg', name: 'Freiburg', lat: 47.999, lng: 7.8421, radiusKm: 40, bundesland: 'baden-wuerttemberg' },
  // Niedersachsen
  { slug: 'hannover', name: 'Hannover', lat: 52.3759, lng: 9.732, radiusKm: 30, bundesland: 'niedersachsen' },
  // Sachsen
  { slug: 'leipzig', name: 'Leipzig', lat: 51.3397, lng: 12.3731, radiusKm: 35, bundesland: 'sachsen' },
  { slug: 'dresden', name: 'Dresden', lat: 51.0504, lng: 13.7373, radiusKm: 35, bundesland: 'sachsen' },
  // Schleswig-Holstein
  { slug: 'kiel', name: 'Kiel', lat: 54.3233, lng: 10.1228, radiusKm: 35, bundesland: 'schleswig-holstein' },
];

const SLUG_TO_CITY = new Map(CITIES.map((c) => [c.slug, c]));

export function cityBySlug(slug: string): City | null {
  return SLUG_TO_CITY.get(slug) ?? null;
}

export function citiesInBundesland(bundeslandSlug: string): City[] {
  return CITIES.filter((c) => c.bundesland === bundeslandSlug);
}
