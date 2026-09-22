import { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { BUNDESLAENDER } from '@/lib/regions';
import { CITIES } from '@/lib/cities';

// ~7000 URLs off two large queries. Crawlers refetch this often, so rebuild it
// six-hourly instead of per request.
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch tournament IDs and club IDs in parallel
  const [tournamentsRes, clubsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id')
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(5000),
    supabase
      .from('golf_clubs')
      .select('id')
      // Merged duplicates 301 to their keeper, so submitting them would only
      // feed Google redirect chains and near-duplicate club pages.
      .is('merged_into', null)
      .limit(2000),
  ]);

  const tournaments = tournamentsRes.data ?? [];
  const clubs = clubsRes.data ?? [];

  const baseUrl = 'https://thepin.app';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/turniere`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/golfturniere`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/clubs`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/karte`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ];

  // Geo hub pages — one evergreen page per Bundesland
  const bundeslandPages: MetadataRoute.Sitemap = BUNDESLAENDER.map((b) => ({
    url: `${baseUrl}/golfturniere/${b.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Metro/city hub pages
  const cityPages: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${baseUrl}/golfturniere/stadt/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Detail pages carry no lastModified. Stamping them with new Date() told
  // Google all ~1700 had changed every six hours, which drove a full recrawl —
  // and a function render per URL. updated_at is no better: the scrapers upsert
  // every row daily and the trigger bumps it whether or not anything changed.
  const tournamentPages: MetadataRoute.Sitemap = tournaments.map((t) => ({
    url: `${baseUrl}/turniere/${t.id}`,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Club pages
  const clubPages: MetadataRoute.Sitemap = clubs.map((c) => ({
    url: `${baseUrl}/clubs/${c.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...bundeslandPages, ...cityPages, ...tournamentPages, ...clubPages];
}
