-- ============================================
-- Where does the traffic come from?
-- ============================================
--
-- page_views recorded what was viewed and (since 022) whether the viewer was
-- logged in, but not how they got here. So a link posted on Instagram was
-- indistinguishable from a Google result or someone typing the domain.
--
-- Four new columns, all filled client-side by web/lib/traffic-source.ts:
--
--   source         'instagram', 'google', 'direct', or an unknown referrer's
--                  host. Derived from utm_source → referring domain → the
--                  in-app-browser signature, in that order.
--   medium         'social' | 'organic' | 'referral' | 'none' — how they came.
--   campaign       utm_campaign, e.g. 'bio' vs 'story', so two Instagram
--                  placements can be told apart.
--   referrer_host  the referring host itself (no path, no query), kept because
--                  a mapped source hides which host it really was
--                  (instagram.com vs l.instagram.com).
--
-- is_entry marks the first tracked view of a browser session: the difference
-- between "120 Instagram page views" and "14 people came from Instagram and
-- looked at 8 pages each". Everything else is a follow-up view inside a visit
-- that keeps the source it started with.
--
-- Rows written before this migration have source NULL and are reported
-- separately (analytics_meta.source_tracking_since), never as 'direct' — the
-- same treatment 022 gave pre-cutoff rows, for the same reason: a missing
-- value is not a measurement.
--
-- APPLY ORDER: run this migration BEFORE deploying the matching web code.
-- /api/track swallows its errors, so inserting columns that do not exist yet
-- would silently drop page views.

ALTER TABLE page_views
    ADD COLUMN IF NOT EXISTS source        TEXT,
    ADD COLUMN IF NOT EXISTS medium        TEXT,
    ADD COLUMN IF NOT EXISTS campaign      TEXT,
    ADD COLUMN IF NOT EXISTS referrer_host TEXT,
    ADD COLUMN IF NOT EXISTS is_entry      BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN page_views.source IS
    'Traffic source: utm_source, else the classified/raw referring host, else ''direct''. NULL = written before migration 027.';
COMMENT ON COLUMN page_views.is_entry IS
    'True on the first tracked view of a browser session — count these for visits, not page views.';

CREATE INDEX IF NOT EXISTS idx_page_views_source ON page_views(source, created_at DESC);
-- Partial: visits are a small slice of all rows, and every visit query filters on it.
CREATE INDEX IF NOT EXISTS idx_page_views_entry ON page_views(created_at DESC) WHERE is_entry;

-- Cutoff for "we started measuring this here", read by the dashboard.
INSERT INTO analytics_meta (key, value)
VALUES ('source_tracking_since', now())
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Reporting functions
-- ============================================
-- Every one of these counts visits (is_entry) alongside views, because the two
-- answer different questions and the ratio is the interesting number.

-- Sources rolled up: the headline "where do they come from" table.
CREATE OR REPLACE FUNCTION traffic_sources(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(source TEXT, medium TEXT, views BIGINT, visits BIGINT, member_views BIGINT) AS $$
  SELECT
    pv.source,
    -- A source usually has one medium; if a link was tagged inconsistently,
    -- report the most frequent one rather than splitting the row.
    MODE() WITHIN GROUP (ORDER BY pv.medium) AS medium,
    COUNT(*)                                        AS views,
    COUNT(*) FILTER (WHERE pv.is_entry)             AS visits,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL)  AS member_views
  FROM page_views pv
  WHERE pv.created_at >= since_date
    AND pv.source IS NOT NULL
  GROUP BY pv.source
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- One level deeper: which link/placement inside a source did the work.
-- 'bio' vs 'story' vs an untagged visit (campaign NULL).
CREATE OR REPLACE FUNCTION traffic_campaigns(since_date TIMESTAMPTZ, lim INT DEFAULT 30)
RETURNS TABLE(source TEXT, medium TEXT, campaign TEXT, views BIGINT, visits BIGINT, member_views BIGINT) AS $$
  SELECT
    pv.source,
    pv.medium,
    pv.campaign,
    COUNT(*)                                        AS views,
    COUNT(*) FILTER (WHERE pv.is_entry)             AS visits,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL)  AS member_views
  FROM page_views pv
  WHERE pv.created_at >= since_date
    AND pv.source IS NOT NULL
    AND pv.campaign IS NOT NULL
  GROUP BY pv.source, pv.medium, pv.campaign
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- The raw referring hosts, mapped or not. This is how a link from a forum or
-- a club website becomes visible without anyone having tagged it.
CREATE OR REPLACE FUNCTION top_referrers(since_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(referrer_host TEXT, views BIGINT, visits BIGINT) AS $$
  SELECT
    pv.referrer_host,
    COUNT(*)                            AS views,
    COUNT(*) FILTER (WHERE pv.is_entry) AS visits
  FROM page_views pv
  WHERE pv.created_at >= since_date
    AND pv.referrer_host IS NOT NULL
  GROUP BY pv.referrer_host
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- Which page people land on per source — "Instagram sends them to the map".
CREATE OR REPLACE FUNCTION source_landing_pages(since_date TIMESTAMPTZ, src TEXT, lim INT DEFAULT 10)
RETURNS TABLE(path TEXT, visits BIGINT) AS $$
  SELECT
    pv.path,
    COUNT(*) AS visits
  FROM page_views pv
  WHERE pv.created_at >= since_date
    AND pv.is_entry
    AND pv.source = src
  GROUP BY pv.path
  ORDER BY visits DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- Headline numbers + the cutoff, so the dashboard can say how much of the
-- range predates source tracking instead of quietly under-reporting.
CREATE OR REPLACE FUNCTION traffic_source_summary(since_date TIMESTAMPTZ)
RETURNS TABLE(
  attributed_views BIGINT,
  untracked_views  BIGINT,
  visits           BIGINT,
  tracking_since   TIMESTAMPTZ
) AS $$
  SELECT
    COUNT(*) FILTER (WHERE pv.source IS NOT NULL),
    COUNT(*) FILTER (WHERE pv.source IS NULL),
    COUNT(*) FILTER (WHERE pv.is_entry),
    (SELECT value FROM analytics_meta WHERE key = 'source_tracking_since')
  FROM page_views pv
  WHERE pv.created_at >= since_date;
$$ LANGUAGE sql STABLE;
