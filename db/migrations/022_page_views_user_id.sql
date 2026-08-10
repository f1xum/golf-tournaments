-- Distinguish logged-in members from anonymous visitors in analytics.
--
-- page_views stored only (path, created_at), so the admin dashboard could not
-- tell a signed-in user apart from a passer-by. user_id is NULL for anonymous
-- visitors AND for every row written before this migration — the two are
-- indistinguishable in the old data, so analytics_meta.user_tracking_since
-- records the cutoff and the dashboard renders anything older as "ohne
-- Aufschlüsselung" instead of silently counting it as a visitor.
--
-- ON DELETE SET NULL: deleting an account degrades their past views to
-- anonymous rather than destroying the historical counts.
--
-- APPLY ORDER: run this migration BEFORE deploying the matching web code.
-- The reverse order makes /api/track insert a column that does not exist yet;
-- that route swallows its errors, so page views would vanish silently.

ALTER TABLE page_views
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Serves both "views by this user" and the DISTINCT user_id counts below.
CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id, created_at DESC);

-- ============================================
-- analytics_meta
-- ============================================
-- No policies → service-role only, same posture as page_views (migration 021).
CREATE TABLE IF NOT EXISTS analytics_meta (
    key   TEXT PRIMARY KEY,
    value TIMESTAMPTZ NOT NULL
);

ALTER TABLE analytics_meta ENABLE ROW LEVEL SECURITY;

INSERT INTO analytics_meta (key, value)
VALUES ('user_tracking_since', now())
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Analytics functions
-- ============================================
-- The top_* functions gain a member_views column and daily_view_counts gains
-- the per-day split. Adding a column to a RETURNS TABLE changes the signature,
-- so each has to be dropped rather than CREATE OR REPLACE'd.

DROP FUNCTION IF EXISTS top_pages(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS top_tournament_pages(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS top_club_pages(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS daily_view_counts(TIMESTAMPTZ);

-- Top pages by view count, with the logged-in share of each
CREATE FUNCTION top_pages(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, member_views BIGINT) AS $$
  SELECT
    path,
    COUNT(*) AS views,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS member_views
  FROM page_views
  WHERE created_at >= since_date
  GROUP BY path
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- Top tournament detail pages with tournament name + club info
CREATE FUNCTION top_tournament_pages(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, member_views BIGINT, tournament_name TEXT, club_name TEXT, club_city TEXT) AS $$
  SELECT
    pv.path,
    COUNT(*) AS views,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL) AS member_views,
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
CREATE FUNCTION top_club_pages(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, member_views BIGINT, club_name TEXT, club_city TEXT, club_region TEXT) AS $$
  SELECT
    pv.path,
    COUNT(*) AS views,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL) AS member_views,
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

-- Daily view counts for the chart, split into member / visitor / pre-cutoff.
-- The three add up to `views`, so the chart can stack them without a remainder.
CREATE FUNCTION daily_view_counts(since_date TIMESTAMPTZ)
RETURNS TABLE(day DATE, views BIGINT, member_views BIGINT, visitor_views BIGINT, untracked_views BIGINT, active_users BIGINT) AS $$
  SELECT
    DATE(pv.created_at) AS day,
    COUNT(*) AS views,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL) AS member_views,
    COUNT(*) FILTER (
      WHERE pv.user_id IS NULL
        AND pv.created_at >= (SELECT value FROM analytics_meta WHERE key = 'user_tracking_since')
    ) AS visitor_views,
    COUNT(*) FILTER (
      WHERE pv.created_at < (SELECT value FROM analytics_meta WHERE key = 'user_tracking_since')
    ) AS untracked_views,
    COUNT(DISTINCT pv.user_id) AS active_users
  FROM page_views pv
  WHERE pv.created_at >= since_date
  GROUP BY DATE(pv.created_at)
  ORDER BY day ASC;
$$ LANGUAGE sql STABLE;

-- Headline audience numbers for the range.
-- active_users counts DISTINCT user_id, which ignores NULLs — so it is the
-- number of signed-in people, not a visitor estimate.
CREATE OR REPLACE FUNCTION audience_summary(since_date TIMESTAMPTZ)
RETURNS TABLE(
  total_views     BIGINT,
  member_views    BIGINT,
  visitor_views   BIGINT,
  untracked_views BIGINT,
  active_users    BIGINT,
  tracking_since  TIMESTAMPTZ
) AS $$
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL),
    COUNT(*) FILTER (
      WHERE pv.user_id IS NULL
        AND pv.created_at >= (SELECT value FROM analytics_meta WHERE key = 'user_tracking_since')
    ),
    COUNT(*) FILTER (
      WHERE pv.created_at < (SELECT value FROM analytics_meta WHERE key = 'user_tracking_since')
    ),
    COUNT(DISTINCT pv.user_id),
    (SELECT value FROM analytics_meta WHERE key = 'user_tracking_since')
  FROM page_views pv
  WHERE pv.created_at >= since_date;
$$ LANGUAGE sql STABLE;
