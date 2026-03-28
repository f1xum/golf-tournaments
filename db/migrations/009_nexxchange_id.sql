-- Add nexxchange issuer ID for tournament scraping
ALTER TABLE golf_clubs ADD COLUMN IF NOT EXISTS nexxchange_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clubs_nexxchange ON golf_clubs (nexxchange_id) WHERE nexxchange_id IS NOT NULL;
