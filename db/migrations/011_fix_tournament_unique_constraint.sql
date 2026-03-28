-- Revert: Restore original unique constraint if it was dropped.
-- The correct conflict key MUST include club_id because the same tournament name
-- (e.g. "Strawberry Tour") can exist at many different clubs on the same date.

DROP INDEX IF EXISTS tournaments_name_date_source_idx;

-- Restore original (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS tournaments_name_date_start_club_id_source_idx
  ON tournaments (name, date_start, club_id, source);
