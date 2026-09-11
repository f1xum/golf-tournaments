-- ============================================
-- User analytics: who signs up, who comes back, what they look at
-- ============================================
--
-- Until now the dashboard could answer "how much traffic" and "where from",
-- but not a single question about people: nobody could see when an account was
-- created, whether that person ever came back, or what they actually opened.
-- page_views has carried user_id since migration 022, so the raw material is
-- there — it just had no reporting on top of it.
--
-- Three things happen in this migration:
--
--   1. Every reporting function gains an `until_date`. Ranges used to be
--      open-ended ("last 30 days"), which cannot express "September" or
--      "1.–14. August". All ranges are now half-open [since, until) — the
--      end is exclusive, so consecutive ranges never double-count a view
--      that lands exactly on midnight.
--
--   2. Days are bucketed in Europe/Berlin, not UTC. `DATE(created_at)` on a
--      timestamptz uses the server zone (UTC), so a visit at 00:30 Berlin time
--      was filed under the previous day, and in summer that misplaced two
--      hours of every night. Every day boundary below goes through
--      `AT TIME ZONE 'Europe/Berlin'`.
--
--   3. New user-level functions, which need auth.users and are therefore
--      SECURITY DEFINER. They are revoked from anon/authenticated at the
--      bottom of this file — they expose e-mail addresses and must stay
--      service-role only, reachable solely through the admin route.
--
-- ON "LOGINS": Supabase only keeps `last_sign_in_at`, one timestamp per
-- account, so literal login counts are not recoverable — and would be
-- misleading anyway, since a session survives for weeks and a daily user may
-- log in once a year. "How often does someone use the app" is answered here by
-- visits (a run of page views with no 30-minute gap) and active days, both
-- derived from page_views. `last_sign_in_at` is still reported as-is.
--
-- HISTORY LIMIT: user_id only exists on rows written after migration 022, so
-- per-user history starts at analytics_meta.user_tracking_since. Anything
-- older counts as traffic but belongs to nobody.
--
-- APPLY ORDER: this migration first, then deploy the web code. The admin route
-- starts sending `until_date`, which the old functions do not accept.

-- ============================================
-- 1. Path labels
-- ============================================
-- /turniere/<uuid> and /clubs/<uuid> are meaningless in a list of what one
-- person looked at. This turns them into names; everything else stays NULL and
-- the UI falls back to the raw path.

CREATE OR REPLACE FUNCTION public.analytics_path_label(p TEXT)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN p ~ '^/turniere/[0-9a-f-]{36}$' THEN
      (SELECT t.name FROM public.tournaments t
        WHERE t.id = CAST(SUBSTRING(p FROM '/turniere/(.+)$') AS UUID))
    WHEN p ~ '^/clubs/[0-9a-f-]{36}$' THEN
      (SELECT c.name FROM public.golf_clubs c
        WHERE c.id = CAST(SUBSTRING(p FROM '/clubs/(.+)$') AS UUID))
    ELSE NULL
  END;
$$ LANGUAGE sql STABLE;

-- ============================================
-- 2. Existing functions, rebuilt with an end date
-- ============================================
-- Signatures change, so these have to be dropped rather than replaced.

DROP FUNCTION IF EXISTS public.top_pages(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.top_tournament_pages(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.top_club_pages(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.daily_view_counts(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.audience_summary(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.traffic_sources(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.traffic_campaigns(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.top_referrers(TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.source_landing_pages(TIMESTAMPTZ, TEXT, INT);
DROP FUNCTION IF EXISTS public.traffic_source_summary(TIMESTAMPTZ);

CREATE FUNCTION public.top_pages(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, member_views BIGINT, visitors BIGINT) AS $$
  SELECT
    pv.path,
    COUNT(*)                                             AS views,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL)       AS member_views,
    COUNT(DISTINCT pv.user_id)                           AS visitors
  FROM public.page_views pv
  WHERE pv.created_at >= since_date AND pv.created_at < until_date
  GROUP BY pv.path
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.top_tournament_pages(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, member_views BIGINT, tournament_name TEXT, club_name TEXT, club_city TEXT) AS $$
  SELECT
    pv.path,
    COUNT(*)                                        AS views,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL)  AS member_views,
    t.name  AS tournament_name,
    gc.name AS club_name,
    gc.city AS club_city
  FROM public.page_views pv
  JOIN public.tournaments t ON t.id = CAST(SUBSTRING(pv.path FROM '/turniere/(.+)$') AS UUID)
  LEFT JOIN public.golf_clubs gc ON gc.id = t.club_id
  WHERE pv.created_at >= since_date AND pv.created_at < until_date
    AND pv.path ~ '^/turniere/[0-9a-f-]{36}$'
  GROUP BY pv.path, t.name, gc.name, gc.city
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.top_club_pages(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(path TEXT, views BIGINT, member_views BIGINT, club_name TEXT, club_city TEXT, club_region TEXT) AS $$
  SELECT
    pv.path,
    COUNT(*)                                        AS views,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL)  AS member_views,
    gc.name   AS club_name,
    gc.city   AS club_city,
    gc.region AS club_region
  FROM public.page_views pv
  JOIN public.golf_clubs gc ON gc.id = CAST(SUBSTRING(pv.path FROM '/clubs/(.+)$') AS UUID)
  WHERE pv.created_at >= since_date AND pv.created_at < until_date
    AND pv.path ~ '^/clubs/[0-9a-f-]{36}$'
  GROUP BY pv.path, gc.name, gc.city, gc.region
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

-- Daily counts, now emitted for every day in the range including empty ones.
-- The client used to pad the gaps, which only worked for "last N days" —
-- generate_series does it correctly for any range.
CREATE FUNCTION public.daily_view_counts(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ)
RETURNS TABLE(day DATE, views BIGINT, member_views BIGINT, visitor_views BIGINT, untracked_views BIGINT, active_users BIGINT, visits BIGINT) AS $$
  WITH days AS (
    SELECT gs::date AS d
    FROM generate_series(
      (since_date AT TIME ZONE 'Europe/Berlin')::date,
      ((until_date AT TIME ZONE 'Europe/Berlin') - INTERVAL '1 microsecond')::date,
      INTERVAL '1 day'
    ) gs
  ),
  counted AS (
    SELECT
      (pv.created_at AT TIME ZONE 'Europe/Berlin')::date AS d,
      COUNT(*)                                       AS views,
      COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL) AS member_views,
      COUNT(*) FILTER (
        WHERE pv.user_id IS NULL
          AND pv.created_at >= (SELECT m.value FROM public.analytics_meta m WHERE m.key = 'user_tracking_since')
      ) AS visitor_views,
      COUNT(*) FILTER (
        WHERE pv.created_at < (SELECT m.value FROM public.analytics_meta m WHERE m.key = 'user_tracking_since')
      ) AS untracked_views,
      COUNT(DISTINCT pv.user_id)          AS active_users,
      COUNT(*) FILTER (WHERE pv.is_entry) AS visits
    FROM public.page_views pv
    WHERE pv.created_at >= since_date AND pv.created_at < until_date
    GROUP BY 1
  )
  SELECT
    days.d,
    COALESCE(c.views, 0),
    COALESCE(c.member_views, 0),
    COALESCE(c.visitor_views, 0),
    COALESCE(c.untracked_views, 0),
    COALESCE(c.active_users, 0),
    COALESCE(c.visits, 0)
  FROM days
  LEFT JOIN counted c ON c.d = days.d
  ORDER BY 1;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.audience_summary(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ)
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
        AND pv.created_at >= (SELECT m.value FROM public.analytics_meta m WHERE m.key = 'user_tracking_since')
    ),
    COUNT(*) FILTER (
      WHERE pv.created_at < (SELECT m.value FROM public.analytics_meta m WHERE m.key = 'user_tracking_since')
    ),
    COUNT(DISTINCT pv.user_id),
    (SELECT m.value FROM public.analytics_meta m WHERE m.key = 'user_tracking_since')
  FROM public.page_views pv
  WHERE pv.created_at >= since_date AND pv.created_at < until_date;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.traffic_sources(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(source TEXT, medium TEXT, views BIGINT, visits BIGINT, member_views BIGINT) AS $$
  SELECT
    pv.source,
    MODE() WITHIN GROUP (ORDER BY pv.medium)        AS medium,
    COUNT(*)                                        AS views,
    COUNT(*) FILTER (WHERE pv.is_entry)             AS visits,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL)  AS member_views
  FROM public.page_views pv
  WHERE pv.created_at >= since_date AND pv.created_at < until_date
    AND pv.source IS NOT NULL
  GROUP BY pv.source
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.traffic_campaigns(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 30)
RETURNS TABLE(source TEXT, medium TEXT, campaign TEXT, views BIGINT, visits BIGINT, member_views BIGINT) AS $$
  SELECT
    pv.source,
    pv.medium,
    pv.campaign,
    COUNT(*)                                        AS views,
    COUNT(*) FILTER (WHERE pv.is_entry)             AS visits,
    COUNT(*) FILTER (WHERE pv.user_id IS NOT NULL)  AS member_views
  FROM public.page_views pv
  WHERE pv.created_at >= since_date AND pv.created_at < until_date
    AND pv.source IS NOT NULL
    AND pv.campaign IS NOT NULL
  GROUP BY pv.source, pv.medium, pv.campaign
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.top_referrers(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 20)
RETURNS TABLE(referrer_host TEXT, views BIGINT, visits BIGINT) AS $$
  SELECT
    pv.referrer_host,
    COUNT(*)                            AS views,
    COUNT(*) FILTER (WHERE pv.is_entry) AS visits
  FROM public.page_views pv
  WHERE pv.created_at >= since_date AND pv.created_at < until_date
    AND pv.referrer_host IS NOT NULL
  GROUP BY pv.referrer_host
  ORDER BY views DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.source_landing_pages(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, src TEXT, lim INT DEFAULT 10)
RETURNS TABLE(path TEXT, visits BIGINT) AS $$
  SELECT
    pv.path,
    COUNT(*) AS visits
  FROM public.page_views pv
  WHERE pv.created_at >= since_date AND pv.created_at < until_date
    AND pv.is_entry
    AND pv.source = src
  GROUP BY pv.path
  ORDER BY visits DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.traffic_source_summary(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ)
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
    (SELECT m.value FROM public.analytics_meta m WHERE m.key = 'source_tracking_since')
  FROM public.page_views pv
  WHERE pv.created_at >= since_date AND pv.created_at < until_date;
$$ LANGUAGE sql STABLE;

-- ============================================
-- 3. People
-- ============================================
-- Everything below reads auth.users, which PostgREST does not expose and RLS
-- does not cover, so these are SECURITY DEFINER with an empty search_path and
-- fully qualified names. They are revoked from anon/authenticated at the end of
-- the file — they return e-mail addresses and are for the admin route only.
--
-- A VISIT is a run of page views by one signed-in person with no gap longer
-- than 30 minutes. The window is clipped to the selected range, so a visit that
-- began just before the range starts is counted once, at its first view inside
-- it. That is the standard trade-off for windowed sessionisation and it keeps
-- the number stable no matter which range is selected.

-- Headline people numbers for the range. The web route calls this twice — once
-- for the range, once for the equally long period before it — which is where
-- the trend arrows come from.
CREATE OR REPLACE FUNCTION public.user_analytics_summary(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ)
RETURNS TABLE(
  total_users       BIGINT,  -- accounts that existed at the end of the range
  new_users         BIGINT,  -- signed up inside the range
  active_users      BIGINT,  -- opened at least one page inside the range
  new_active_users  BIGINT,  -- signed up AND used it inside the range
  returning_users   BIGINT,  -- existed before the range and came back into it
  repeat_users      BIGINT,  -- active on two or more separate days
  dormant_users     BIGINT,  -- existed before the range, never showed up in it
  visits            BIGINT,
  member_views      BIGINT,
  active_days       BIGINT,  -- summed over users, for the per-user average
  tracking_since    TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH ordered AS (
    SELECT
      pv.user_id AS uid,
      pv.created_at AS at,
      LAG(pv.created_at) OVER (PARTITION BY pv.user_id ORDER BY pv.created_at) AS prev_at
    FROM public.page_views pv
    WHERE pv.user_id IS NOT NULL
      AND pv.created_at >= since_date AND pv.created_at < until_date
  ),
  per_user AS (
    SELECT
      o.uid,
      COUNT(*) AS views,
      COUNT(DISTINCT (o.at AT TIME ZONE 'Europe/Berlin')::date) AS days,
      COUNT(*) FILTER (WHERE o.prev_at IS NULL OR o.at - o.prev_at > INTERVAL '30 minutes') AS sessions
    FROM ordered o
    GROUP BY o.uid
  ),
  accounts AS (
    SELECT u.id, u.created_at
    FROM auth.users u
    WHERE u.deleted_at IS NULL AND u.created_at < until_date
  )
  SELECT
    (SELECT COUNT(*) FROM accounts),
    (SELECT COUNT(*) FROM accounts a WHERE a.created_at >= since_date),
    (SELECT COUNT(*) FROM per_user),
    (SELECT COUNT(*) FROM per_user pu JOIN accounts a ON a.id = pu.uid WHERE a.created_at >= since_date),
    (SELECT COUNT(*) FROM per_user pu JOIN accounts a ON a.id = pu.uid WHERE a.created_at <  since_date),
    (SELECT COUNT(*) FROM per_user pu WHERE pu.days >= 2),
    (SELECT COUNT(*) FROM accounts a
      WHERE a.created_at < since_date
        AND NOT EXISTS (SELECT 1 FROM per_user pu WHERE pu.uid = a.id)),
    (SELECT COALESCE(SUM(pu.sessions), 0) FROM per_user pu),
    (SELECT COALESCE(SUM(pu.views), 0) FROM per_user pu),
    (SELECT COALESCE(SUM(pu.days), 0) FROM per_user pu),
    (SELECT m.value FROM public.analytics_meta m WHERE m.key = 'user_tracking_since');
$$;

-- One row per day: signups against usage, split into people who were already
-- here and people who arrived that day. This is the "do they come back" chart.
CREATE OR REPLACE FUNCTION public.user_activity_daily(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ)
RETURNS TABLE(
  day                    DATE,
  signups                BIGINT,
  total_users            BIGINT,  -- cumulative, end of that day
  active_users           BIGINT,
  new_active_users       BIGINT,
  returning_active_users BIGINT,
  visits                 BIGINT,
  member_views           BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH days AS (
    SELECT gs::date AS d
    FROM pg_catalog.generate_series(
      (since_date AT TIME ZONE 'Europe/Berlin')::date,
      ((until_date AT TIME ZONE 'Europe/Berlin') - INTERVAL '1 microsecond')::date,
      INTERVAL '1 day'
    ) gs
  ),
  ordered AS (
    SELECT
      pv.user_id AS uid,
      (pv.created_at AT TIME ZONE 'Europe/Berlin')::date AS d,
      pv.created_at AS at,
      LAG(pv.created_at) OVER (PARTITION BY pv.user_id ORDER BY pv.created_at) AS prev_at
    FROM public.page_views pv
    WHERE pv.user_id IS NOT NULL
      AND pv.created_at >= since_date AND pv.created_at < until_date
  ),
  -- Someone counts as "new" on a day only if they signed up that same day.
  activity AS (
    SELECT
      o.d,
      COUNT(DISTINCT o.uid) AS active_users,
      COUNT(DISTINCT o.uid) FILTER (
        WHERE (SELECT (u.created_at AT TIME ZONE 'Europe/Berlin')::date FROM auth.users u WHERE u.id = o.uid) = o.d
      ) AS new_active_users,
      COUNT(*) FILTER (WHERE o.prev_at IS NULL OR o.at - o.prev_at > INTERVAL '30 minutes') AS visits,
      COUNT(*) AS member_views
    FROM ordered o
    GROUP BY o.d
  ),
  signups AS (
    SELECT (u.created_at AT TIME ZONE 'Europe/Berlin')::date AS d, COUNT(*) AS n
    FROM auth.users u
    WHERE u.deleted_at IS NULL
      AND u.created_at >= since_date AND u.created_at < until_date
    GROUP BY 1
  )
  SELECT
    days.d,
    COALESCE(s.n, 0),
    (SELECT COUNT(*) FROM auth.users u
      WHERE u.deleted_at IS NULL
        AND u.created_at < ((days.d + 1)::timestamp AT TIME ZONE 'Europe/Berlin')),
    COALESCE(a.active_users, 0),
    COALESCE(a.new_active_users, 0),
    COALESCE(a.active_users, 0) - COALESCE(a.new_active_users, 0),
    COALESCE(a.visits, 0),
    COALESCE(a.member_views, 0)
  FROM days
  LEFT JOIN activity a ON a.d = days.d
  LEFT JOIN signups  s ON s.d = days.d
  ORDER BY 1;
$$;

-- Every account, with what it did inside the range and what it has done ever.
-- Dormant accounts are included on purpose: "who has not come back" is as much
-- of an answer as "who has".
CREATE OR REPLACE FUNCTION public.user_directory(since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 500)
RETURNS TABLE(
  user_id              UUID,
  email                TEXT,
  username             TEXT,
  display_name         TEXT,
  home_club            TEXT,
  handicap             NUMERIC,
  role                 TEXT,
  signed_up_at         TIMESTAMPTZ,
  last_sign_in_at      TIMESTAMPTZ,
  last_seen_at         TIMESTAMPTZ,
  views_in_range       BIGINT,
  active_days_in_range BIGINT,
  visits_in_range      BIGINT,
  total_views          BIGINT,
  total_active_days    BIGINT,
  saved_tournaments    BIGINT,
  saved_clubs          BIGINT,
  is_new               BOOLEAN,
  is_active            BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH ordered AS (
    SELECT
      pv.user_id AS uid,
      pv.created_at AS at,
      LAG(pv.created_at) OVER (PARTITION BY pv.user_id ORDER BY pv.created_at) AS prev_at
    FROM public.page_views pv
    WHERE pv.user_id IS NOT NULL
      AND pv.created_at >= since_date AND pv.created_at < until_date
  ),
  in_range AS (
    SELECT
      o.uid,
      COUNT(*) AS views,
      COUNT(DISTINCT (o.at AT TIME ZONE 'Europe/Berlin')::date) AS days,
      COUNT(*) FILTER (WHERE o.prev_at IS NULL OR o.at - o.prev_at > INTERVAL '30 minutes') AS sessions
    FROM ordered o
    GROUP BY o.uid
  ),
  -- Lifetime numbers ignore the range: "last seen" must not read as "never"
  -- just because the selected window happens to exclude their last visit.
  lifetime AS (
    SELECT
      pv.user_id AS uid,
      COUNT(*) AS views,
      COUNT(DISTINCT (pv.created_at AT TIME ZONE 'Europe/Berlin')::date) AS days,
      MAX(pv.created_at) AS last_seen
    FROM public.page_views pv
    WHERE pv.user_id IS NOT NULL
    GROUP BY pv.user_id
  )
  SELECT
    u.id,
    u.email::text,
    p.username,
    p.display_name,
    gc.name,
    p.handicap,
    p.role,
    u.created_at,
    u.last_sign_in_at,
    l.last_seen,
    COALESCE(r.views, 0),
    COALESCE(r.days, 0),
    COALESCE(r.sessions, 0),
    COALESCE(l.views, 0),
    COALESCE(l.days, 0),
    COALESCE(st.n, 0),
    COALESCE(sc.n, 0),
    (u.created_at >= since_date AND u.created_at < until_date),
    (r.uid IS NOT NULL)
  FROM auth.users u
  LEFT JOIN public.profiles   p  ON p.id = u.id
  LEFT JOIN public.golf_clubs gc ON gc.id = p.home_club_id
  LEFT JOIN in_range r ON r.uid = u.id
  LEFT JOIN lifetime l ON l.uid = u.id
  LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM public.saved_tournaments s WHERE s.user_id = u.id) st ON TRUE
  LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM public.saved_clubs       s WHERE s.user_id = u.id) sc ON TRUE
  WHERE u.deleted_at IS NULL
    AND u.created_at < until_date
  ORDER BY COALESCE(r.views, 0) DESC, l.last_seen DESC NULLS LAST, u.created_at DESC
  LIMIT lim;
$$;

-- Signup-week cohorts against the weeks that followed. Offset 0 is the signup
-- week itself, so a healthy product keeps a visible tail to the right.
-- Cohorts with no activity at all still return one row (offset 0, zero active)
-- so the grid shows them instead of hiding a cohort that never came back.
CREATE OR REPLACE FUNCTION public.user_retention_cohorts(weeks_back INT DEFAULT 12)
RETURNS TABLE(cohort_week DATE, cohort_size BIGINT, week_offset INT, active_users BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH cohorts AS (
    SELECT
      u.id AS uid,
      (pg_catalog.date_trunc('week', u.created_at AT TIME ZONE 'Europe/Berlin'))::date AS cw
    FROM auth.users u
    WHERE u.deleted_at IS NULL
      AND u.created_at >= (
        (pg_catalog.date_trunc('week', (pg_catalog.now() AT TIME ZONE 'Europe/Berlin'))
          - pg_catalog.make_interval(weeks => weeks_back)) AT TIME ZONE 'Europe/Berlin'
      )
  ),
  sizes AS (
    SELECT c.cw, COUNT(*) AS size FROM cohorts c GROUP BY c.cw
  ),
  activity AS (
    SELECT
      c.cw,
      c.uid,
      (((pg_catalog.date_trunc('week', pv.created_at AT TIME ZONE 'Europe/Berlin'))::date - c.cw) / 7)::int AS offs
    FROM cohorts c
    JOIN public.page_views pv ON pv.user_id = c.uid
  )
  SELECT
    s.cw,
    s.size,
    COALESCE(a.offs, 0),
    COUNT(DISTINCT a.uid)
  FROM sizes s
  LEFT JOIN activity a ON a.cw = s.cw AND a.offs >= 0
  GROUP BY s.cw, s.size, COALESCE(a.offs, 0)
  ORDER BY 1 DESC, 3 ASC;
$$;

-- What one person actually opened, most-viewed first.
CREATE OR REPLACE FUNCTION public.user_top_pages(target_user UUID, since_date TIMESTAMPTZ, until_date TIMESTAMPTZ, lim INT DEFAULT 15)
RETURNS TABLE(path TEXT, label TEXT, views BIGINT, last_viewed TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    pv.path,
    public.analytics_path_label(pv.path),
    COUNT(*),
    MAX(pv.created_at)
  FROM public.page_views pv
  WHERE pv.user_id = target_user
    AND pv.created_at >= since_date AND pv.created_at < until_date
  GROUP BY pv.path
  ORDER BY 3 DESC, 4 DESC
  LIMIT lim;
$$;

-- The same person's last steps through the site, newest first. Not restricted
-- to the range: when someone has been quiet, their last session is the
-- interesting thing, whenever it was.
CREATE OR REPLACE FUNCTION public.user_recent_views(target_user UUID, lim INT DEFAULT 25)
RETURNS TABLE(path TEXT, label TEXT, viewed_at TIMESTAMPTZ, source TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    pv.path,
    public.analytics_path_label(pv.path),
    pv.created_at,
    pv.source
  FROM public.page_views pv
  WHERE pv.user_id = target_user
  ORDER BY pv.created_at DESC
  LIMIT lim;
$$;

-- ============================================
-- 4. Lock the people functions down
-- ============================================
-- SECURITY DEFINER plus the default EXECUTE grant to PUBLIC would let anyone
-- holding the anon key read every user's e-mail address through PostgREST.
-- Only the service role (the admin route) may call these.

REVOKE ALL ON FUNCTION public.user_analytics_summary(TIMESTAMPTZ, TIMESTAMPTZ)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_activity_daily(TIMESTAMPTZ, TIMESTAMPTZ)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_directory(TIMESTAMPTZ, TIMESTAMPTZ, INT)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_retention_cohorts(INT)                                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_top_pages(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_recent_views(UUID, INT)                                FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.user_analytics_summary(TIMESTAMPTZ, TIMESTAMPTZ)         TO service_role;
GRANT EXECUTE ON FUNCTION public.user_activity_daily(TIMESTAMPTZ, TIMESTAMPTZ)            TO service_role;
GRANT EXECUTE ON FUNCTION public.user_directory(TIMESTAMPTZ, TIMESTAMPTZ, INT)            TO service_role;
GRANT EXECUTE ON FUNCTION public.user_retention_cohorts(INT)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.user_top_pages(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT)      TO service_role;
GRANT EXECUTE ON FUNCTION public.user_recent_views(UUID, INT)                             TO service_role;
