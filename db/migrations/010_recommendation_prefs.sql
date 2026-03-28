-- Recommendation preferences for "Für dich" tournament suggestions
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recommendation_max_distance INT;  -- km, null = no limit
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recommendation_prefer_hcp BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recommendation_formats TEXT[];  -- preferred formats, null = all
