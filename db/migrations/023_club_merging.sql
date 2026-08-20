-- ============================================
-- Club de-duplication via canonical pointers
-- ============================================
--
-- The same physical club exists in golf_clubs several times over, because
-- different sources spell it differently ("GC Am Reichswald" vs
-- "GC Am Reichswald e. V.", "Golfclub Eschenried e.V. – Eschenhof" vs
-- "Münchner Golf Eschenried - Platz Eschenhof"). Tournaments attach to
-- whichever row the scraper matched, so the twin rows look like clubs that
-- never host a tournament. That is the single biggest source of "this club
-- has no tournaments" reports.
--
-- We merge by pointing the losing rows at a keeper instead of deleting them:
-- club URLs are already indexed by Google and referenced from saved_clubs and
-- profiles.home_club_id, so a delete would 404 real traffic and drop user
-- data. A pointer lets the app 301 the duplicate to the keeper, and lets a bad
-- merge be undone by setting the column back to NULL.

ALTER TABLE golf_clubs
    ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES golf_clubs(id) ON DELETE SET NULL;

COMMENT ON COLUMN golf_clubs.merged_into IS
    'Set when this row is a duplicate of another club. Reads should follow the '
    'pointer to the keeper; listings should hide rows where this is not null. '
    'NULL = canonical row.';

-- Listings filter on `merged_into IS NULL`, which is the overwhelming majority
-- of rows, so index the small duplicate side for the reverse lookup instead.
CREATE INDEX IF NOT EXISTS idx_clubs_merged_into
    ON golf_clubs (merged_into) WHERE merged_into IS NOT NULL;

-- A duplicate must not itself be a keeper: merge chains would make the app
-- follow more than one hop. The merge script always resolves to a root before
-- writing, and this guards against a manual edit reintroducing a chain.
ALTER TABLE golf_clubs
    ADD CONSTRAINT chk_clubs_no_self_merge CHECK (merged_into IS DISTINCT FROM id);
