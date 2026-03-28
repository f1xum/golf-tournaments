import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch tournament IDs and club IDs in parallel
  const [tournamentsRes, clubsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id,date_start')
      .gte('date_start', today)
      .order('date_start', { ascending: true })
      .limit(5000),
    supabase
      .from('golf_clubs')
      .select('id')
      .limit(2000),
  ]);

  const tournaments = tournamentsRes.data ?? [];
  const clubs = clubsRes.data ?? [];

  const baseUrl = 'https://thepin.app';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/turniere`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/clubs`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/karte`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ];

  // Tournament pages
  const tournamentPages: MetadataRoute.Sitemap = tournaments.map((t) => ({
    url: `${baseUrl}/turniere/${t.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Club pages
  const clubPages: MetadataRoute.Sitemap = clubs.map((c) => ({
    url: `${baseUrl}/clubs/${c.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...tournamentPages, ...clubPages];
}
