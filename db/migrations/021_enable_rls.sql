-- Enable Row-Level Security on the four tables that still had it off.
--
-- Why this matters: NEXT_PUBLIC_SUPABASE_ANON_KEY ships in the browser bundle,
-- so it is public. With RLS off, anyone holding it can not only read these
-- tables but INSERT / UPDATE / DELETE in them — i.e. wipe every tournament.
--
-- Model after this migration:
--   golf_clubs   → world-readable (the site renders it), writes only via
--                  service role (scrapers) or an admin session (course-data UI)
--   tournaments  → world-readable, writes only via service role
--   page_views   → no public access at all; /api/track and the admin analytics
--                  route use the service-role client
--   scrape_logs  → no public access at all; written by scrapers (service role)
--
-- The service-role key bypasses RLS entirely, so no policies are needed for it.
--
-- PREREQUISITE: scrapers and the two analytics routes must be on the
-- service-role key BEFORE this runs, otherwise their writes/reads start failing.

-- ============================================
-- golf_clubs
-- ============================================
ALTER TABLE golf_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS golf_clubs_public_read ON golf_clubs;
CREATE POLICY golf_clubs_public_read
    ON golf_clubs
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- The admin course-data review UI promotes candidates straight from the
-- browser (app/admin/course-data/client.tsx), so admins need UPDATE.
DROP POLICY IF EXISTS golf_clubs_admin_update ON golf_clubs;
CREATE POLICY golf_clubs_admin_update
    ON golf_clubs
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- ============================================
-- tournaments
-- ============================================
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournaments_public_read ON tournaments;
CREATE POLICY tournaments_public_read
    ON tournaments
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- ============================================
-- page_views  (no policies → service role only)
-- ============================================
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- ============================================
-- scrape_logs  (no policies → service role only)
-- ============================================
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;
