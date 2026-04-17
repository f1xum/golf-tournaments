-- Extends notifications with:
--   - email_sent_at column (so the cron knows what's already been emailed)
--   - generate_new_tournament_nearby() — new tournaments near user's home club
--   - generate_hcp_match() — new tournaments matching user's handicap
--   - updates generate_all_notifications() to fan out to all four generators

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_email_pending
  ON notifications (created_at)
  WHERE email_sent_at IS NULL;

-- Inline haversine in km (matches web/lib/utils.ts distanceKm).
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2)) ^ 2
    + cos(radians(lat1)) * cos(radians(lat2))
      * sin(radians((lon2 - lon1) / 2)) ^ 2
  ));
$$ LANGUAGE sql IMMUTABLE;

-- 3) New tournament nearby: tournament created in the last 24h, within user's
--    recommendation_max_distance (or 100 km default) of home_club
CREATE OR REPLACE FUNCTION generate_new_tournament_nearby()
RETURNS INT AS $$
DECLARE
  inserted INT := 0;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, tournament_id)
  SELECT
    p.id,
    'new_tournament_nearby'::notification_type,
    'Neues Turnier in deiner Nähe: ' || t.name,
    'Am ' || to_char(t.date_start, 'DD.MM.YYYY') || ' bei ' || tc.name,
    t.id
  FROM profiles p
  JOIN golf_clubs hc ON hc.id = p.home_club_id
  JOIN tournaments t ON t.date_start >= CURRENT_DATE
                    AND t.created_at >= now() - interval '24 hours'
  JOIN golf_clubs tc ON tc.id = t.club_id
  WHERE p.notify_new_nearby = true
    AND hc.latitude IS NOT NULL AND hc.longitude IS NOT NULL
    AND tc.latitude IS NOT NULL AND tc.longitude IS NOT NULL
    AND haversine_km(hc.latitude, hc.longitude, tc.latitude, tc.longitude)
        <= COALESCE(p.recommendation_max_distance, 100)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id
        AND n.tournament_id = t.id
        AND n.type = 'new_tournament_nearby'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) HCP match: new tournament whose HCP range covers the user's handicap
CREATE OR REPLACE FUNCTION generate_hcp_match()
RETURNS INT AS $$
DECLARE
  inserted INT := 0;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, tournament_id)
  SELECT
    p.id,
    'hcp_match'::notification_type,
    'Passend zu deinem HCP: ' || t.name,
    'Am ' || to_char(t.date_start, 'DD.MM.YYYY')
      || CASE
           WHEN t.min_handicap IS NOT NULL AND t.max_handicap IS NOT NULL
             THEN ' (HCP ' || t.min_handicap || '–' || t.max_handicap || ')'
           WHEN t.max_handicap IS NOT NULL
             THEN ' (bis HCP ' || t.max_handicap || ')'
           ELSE ''
         END,
    t.id
  FROM profiles p
  JOIN tournaments t ON t.date_start >= CURRENT_DATE
                    AND t.created_at >= now() - interval '24 hours'
  WHERE p.notify_hcp_match = true
    AND p.handicap IS NOT NULL
    AND (t.min_handicap IS NOT NULL OR t.max_handicap IS NOT NULL)
    AND (t.min_handicap IS NULL OR p.handicap >= t.min_handicap)
    AND (t.max_handicap IS NULL OR p.handicap <= t.max_handicap)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id
        AND n.tournament_id = t.id
        AND n.type = 'hcp_match'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace combined runner to include all four generators.
-- Must DROP first because the return type changes from (reminders, closing)
-- to (reminders, closing, nearby, hcp) — Postgres forbids CREATE OR REPLACE
-- when the return signature differs.
DROP FUNCTION IF EXISTS generate_all_notifications();

CREATE OR REPLACE FUNCTION generate_all_notifications()
RETURNS TABLE(reminders INT, closing INT, nearby INT, hcp INT) AS $$
DECLARE
  r INT; c INT; n INT; h INT;
BEGIN
  SELECT generate_tournament_reminders()    INTO r;
  SELECT generate_registration_closing()    INTO c;
  SELECT generate_new_tournament_nearby()   INTO n;
  SELECT generate_hcp_match()               INTO h;
  RETURN QUERY SELECT r, c, n, h;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
