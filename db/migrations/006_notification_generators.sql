-- Helper: extract a date from German meldeschluss text like
-- "Mi, 19.03.2026, 12:00 Uhr" or "19.03.2026" → DATE
CREATE OR REPLACE FUNCTION parse_meldeschluss_date(raw TEXT)
RETURNS DATE AS $$
DECLARE
  m TEXT[];
BEGIN
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  -- Match DD.MM.YYYY pattern
  m := regexp_match(raw, '(\d{1,2})\.(\d{1,2})\.(\d{4})');
  IF m IS NULL THEN RETURN NULL; END IF;
  BEGIN
    RETURN make_date(m[3]::INT, m[2]::INT, m[1]::INT);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1) Tournament reminders: saved tournament starting within reminder_days_before
CREATE OR REPLACE FUNCTION generate_tournament_reminders()
RETURNS INT AS $$
DECLARE
  inserted INT := 0;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, tournament_id)
  SELECT
    p.id,
    'tournament_reminder'::notification_type,
    t.name,
    'Startet am ' || to_char(t.date_start::DATE, 'DD.MM.YYYY'),
    t.id
  FROM saved_tournaments st
  JOIN profiles p ON p.id = st.user_id
  JOIN tournaments t ON t.id = st.tournament_id
  WHERE p.notify_tournament_reminder = true
    AND t.date_start::DATE BETWEEN CURRENT_DATE AND CURRENT_DATE + p.reminder_days_before
    -- Don't create duplicates
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id
        AND n.tournament_id = t.id
        AND n.type = 'tournament_reminder'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Registration closing: meldeschluss within 2 days
CREATE OR REPLACE FUNCTION generate_registration_closing()
RETURNS INT AS $$
DECLARE
  inserted INT := 0;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, tournament_id)
  SELECT
    p.id,
    'registration_closing'::notification_type,
    'Meldeschluss: ' || t.name,
    'Anmeldung endet am ' || to_char(ms_date, 'DD.MM.YYYY'),
    t.id
  FROM saved_tournaments st
  JOIN profiles p ON p.id = st.user_id
  JOIN tournaments t ON t.id = st.tournament_id
  CROSS JOIN LATERAL (
    SELECT parse_meldeschluss_date(t.raw_data->>'meldeschluss') AS ms_date
  ) dates
  WHERE p.notify_registration_closing = true
    AND dates.ms_date IS NOT NULL
    AND dates.ms_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2
    -- Don't create duplicates
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id
        AND n.tournament_id = t.id
        AND n.type = 'registration_closing'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Combined function to call both generators
CREATE OR REPLACE FUNCTION generate_all_notifications()
RETURNS TABLE(reminders INT, closing INT) AS $$
DECLARE
  r INT;
  c INT;
BEGIN
  SELECT generate_tournament_reminders() INTO r;
  SELECT generate_registration_closing() INTO c;
  RETURN QUERY SELECT r, c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via pg_cron: run daily at 7:00 AM UTC
-- (Uncomment after enabling pg_cron in Supabase dashboard → Database → Extensions)
-- SELECT cron.schedule(
--   'generate-notifications',
--   '0 7 * * *',
--   'SELECT generate_all_notifications()'
-- );
