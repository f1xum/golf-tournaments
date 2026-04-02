-- Top pages by view count
CREATE OR REPLACE FUNCTION top_pages(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT) AS $$
  SELECT path, COUNT(*) AS views
  FROM page_views
  WHERE created_at >= since_date
  GROUP BY path
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- Top tournament detail pages with tournament name + club info
CREATE OR REPLACE FUNCTION top_tournament_pages(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, tournament_name TEXT, club_name TEXT, club_city TEXT) AS $$
  SELECT
    pv.path,
    COUNT(*) AS views,
    t.name AS tournament_name,
    gc.name AS club_name,
    gc.city AS club_city
  FROM page_views pv
  JOIN tournaments t ON t.id = CAST(SUBSTRING(pv.path FROM '/turniere/(.+)$') AS UUID)
  LEFT JOIN golf_clubs gc ON gc.id = t.club_id
  WHERE pv.created_at >= since_date
    AND pv.path ~ '^/turniere/[0-9a-f-]{36}$'
  GROUP BY pv.path, t.name, gc.name, gc.city
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- Top club detail pages with club info
CREATE OR REPLACE FUNCTION top_club_pages(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, club_name TEXT, club_city TEXT, club_region TEXT) AS $$
  SELECT
    pv.path,
    COUNT(*) AS views,
    gc.name AS club_name,
    gc.city AS club_city,
    gc.region AS club_region
  FROM page_views pv
  JOIN golf_clubs gc ON gc.id = CAST(SUBSTRING(pv.path FROM '/clubs/(.+)$') AS UUID)
  WHERE pv.created_at >= since_date
    AND pv.path ~ '^/clubs/[0-9a-f-]{36}$'
  GROUP BY pv.path, gc.name, gc.city, gc.region
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- Daily view counts for chart
CREATE OR REPLACE FUNCTION daily_view_counts(since_date TIMESTAMPTZ)
RETURNS TABLE(day DATE, views BIGINT) AS $$
  SELECT
    DATE(created_at) AS day,
    COUNT(*) AS views
  FROM page_views
  WHERE created_at >= since_date
  GROUP BY DATE(created_at)
  ORDER BY day ASC;
$$ LANGUAGE sql STABLE;
