-- ============================================
-- Record which tournament platform a club uses
-- ============================================
--
-- Coverage was being modelled as "has a pccaddie_id or is broken", which hid
-- the real picture. Scanning the Bavarian clubs that had no pccaddie_id turned
-- up a second platform entirely: Albatros, at {slug}.albatros9.net/a9online/.
-- Münchener Golf Club — one of the clubs users complained about — is on it.
--
-- Note the old discovery script matched /albatros\.net/, which never fires:
-- the host is albatros9.net. So Albatros usage has been invisible until now.
--
-- Storing the platform explicitly means a club with no tournaments can be told
-- apart from a club we simply cannot read yet, which is the difference between
-- a scraper backlog item and a dead end.

ALTER TABLE public.golf_clubs
    ADD COLUMN IF NOT EXISTS albatros_id TEXT;

ALTER TABLE public.golf_clubs
    ADD COLUMN IF NOT EXISTS tournament_platform TEXT;

-- Albatros requires authentication, so there is no feed to read for those
-- clubs. What they do publish is a PDF Wettspielkalender on their own site.
-- src/scrapers/club_pdf_calendar.py reads tournaments out of it.
ALTER TABLE public.golf_clubs
    ADD COLUMN IF NOT EXISTS calendar_pdf_url TEXT;

COMMENT ON COLUMN public.golf_clubs.albatros_id IS
    'Albatros tenant slug: https://{albatros_id}.albatros9.net/a9online/#/tournaments';

COMMENT ON COLUMN public.golf_clubs.tournament_platform IS
    'Detected tournament system: pccaddie | albatros | nexxchange | pdf | '
    'unknown (scanned, nothing found) | NULL (not scanned yet). Drives which '
    'scraper picks the club up, and reports on what is still unreachable.';

COMMENT ON COLUMN public.golf_clubs.calendar_pdf_url IS
    'URL of the club''s published PDF tournament calendar, when it has one.';

CREATE INDEX IF NOT EXISTS idx_clubs_platform
    ON public.golf_clubs (tournament_platform);
