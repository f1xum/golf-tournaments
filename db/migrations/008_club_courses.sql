-- Add course info to golf_clubs
ALTER TABLE golf_clubs ADD COLUMN IF NOT EXISTS courses JSONB;
-- Example: [{"name": "18-Loch-Schleife", "holes": 18}, {"name": "9-Loch-Schleife", "holes": 9}]

ALTER TABLE golf_clubs ADD COLUMN IF NOT EXISTS has_9_holes BOOLEAN DEFAULT FALSE;
ALTER TABLE golf_clubs ADD COLUMN IF NOT EXISTS has_18_holes BOOLEAN DEFAULT FALSE;

-- Add pccaddie_id for easy mapping
ALTER TABLE golf_clubs ADD COLUMN IF NOT EXISTS pccaddie_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clubs_pccaddie ON golf_clubs (pccaddie_id) WHERE pccaddie_id IS NOT NULL;
