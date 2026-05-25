-- Staging table for the course-data backfill pipeline.
--
-- Lifecycle:
--   discovered  → crawler found a candidate asset URL (no extraction yet)
--   extracted   → vision LLM produced structured course_data JSON; awaiting review
--   approved    → promoted to golf_clubs.course_data
--   rejected    → human marked the extraction as wrong; do not retry without changes
--   failed      → extractor errored; safe to retry
--
-- (club_id, asset_url) uniqueness ensures re-running the crawler is idempotent.

CREATE TABLE IF NOT EXISTS course_data_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES golf_clubs(id) ON DELETE CASCADE,

    source_url TEXT NOT NULL,           -- page where we found the link
    asset_url TEXT NOT NULL,            -- the candidate PDF / page URL itself
    asset_type TEXT NOT NULL,           -- 'course_rating' | 'birdiebook' | 'platz_page' | 'other'

    status TEXT NOT NULL DEFAULT 'discovered',
    extracted_data JSONB,               -- LLM output, shape matches CourseData
    extraction_notes TEXT,              -- LLM rationale, validation warnings, or error text

    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    extracted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,

    UNIQUE (club_id, asset_url)
);

CREATE INDEX IF NOT EXISTS idx_course_candidates_club
    ON course_data_candidates (club_id);
CREATE INDEX IF NOT EXISTS idx_course_candidates_status
    ON course_data_candidates (status);
CREATE INDEX IF NOT EXISTS idx_course_candidates_type_status
    ON course_data_candidates (asset_type, status);

-- RLS: only admins read/write; no public exposure.
ALTER TABLE course_data_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_candidates_admin_all ON course_data_candidates;
CREATE POLICY course_candidates_admin_all
    ON course_data_candidates
    FOR ALL
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
