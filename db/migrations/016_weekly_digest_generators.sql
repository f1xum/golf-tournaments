-- Switch `new_tournament_nearby` and `hcp_match` from per-tournament daily
-- notifications to a weekly digest (one row per user, fires Mondays only).
-- Per-tournament noise was unusable: daily scrapers add many tournaments,
-- each matching many users → tens of notifications per user per day.

-- 1. Clean up the existing flood.
DELETE FROM notifications
WHERE type IN ('new_tournament_nearby', 'hcp_match');

-- 2. Replace generators with weekly digest versions.
--    Both:
--    - Only insert when today is Monday (DOW = 1).
--    - Consider tournaments created in the past 7 days.
--    - Insert ONE notification per user (tournament_id = NULL).
--    - Dedup: skip if a notification of this type was created for this user
--      in the last 6 days (robust against minor schedule drift).

CREATE OR REPLACE FUNCTION generate_new_tournament_nearby()
RETURNS INT AS $$
DECLARE
  inserted INT := 0;
BEGIN
  IF EXTRACT(DOW FROM CURRENT_DATE) <> 1 THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, tournament_id)
  SELECT
    p.id,
    'new_tournament_nearby'::notification_type,
    CASE
      WHEN matches.n = 1 THEN '1 neues Turnier in deiner Nähe'
      ELSE matches.n || ' neue Turniere in deiner Nähe'
    END,
    'Diese Woche neu: Turniere bei dir um die Ecke.',
    NULL
  FROM profiles p
  JOIN golf_clubs hc ON hc.id = p.home_club_id
  JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM tournaments t
    JOIN golf_clubs tc ON tc.id = t.club_id
    WHERE t.date_start >= CURRENT_DATE
      AND t.created_at >= now() - interval '7 days'
      AND tc.latitude IS NOT NULL AND tc.longitude IS NOT NULL
      AND haversine_km(hc.latitude, hc.longitude, tc.latitude, tc.longitude)
          <= COALESCE(p.recommendation_max_distance, 100)
  ) matches ON matches.n > 0
  WHERE p.notify_new_nearby = true
    AND hc.latitude IS NOT NULL AND hc.longitude IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id
        AND n.type = 'new_tournament_nearby'
        AND n.created_at > now() - interval '6 days'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_hcp_match()
RETURNS INT AS $$
DECLARE
  inserted INT := 0;
BEGIN
  IF EXTRACT(DOW FROM CURRENT_DATE) <> 1 THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, tournament_id)
  SELECT
    p.id,
    'hcp_match'::notification_type,
    CASE
      WHEN matches.n = 1 THEN '1 neues Turnier passt zu deinem HCP'
      ELSE matches.n || ' neue Turniere passen zu deinem HCP'
    END,
    'Diese Woche neu: Turniere, bei denen dein Handicap passt.',
    NULL
  FROM profiles p
  JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM tournaments t
    WHERE t.date_start >= CURRENT_DATE
      AND t.created_at >= now() - interval '7 days'
      AND (t.min_handicap IS NOT NULL OR t.max_handicap IS NOT NULL)
      AND (t.min_handicap IS NULL OR p.handicap >= t.min_handicap)
      AND (t.max_handicap IS NULL OR p.handicap <= t.max_handicap)
  ) matches ON matches.n > 0
  WHERE p.notify_hcp_match = true
    AND p.handicap IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id
        AND n.type = 'hcp_match'
        AND n.created_at > now() - interval '6 days'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
