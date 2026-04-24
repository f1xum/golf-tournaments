-- Reclassify tournaments stuck as 'other' using substring matching.
--
-- Before this change, tournaments.format was set by an exact-match dict
-- lookup against a short list of keys. Real scraper output is compound
-- ("Einzel - Texas Scramble (Stableford - 2 Spieler)", "Vierer / Scramble",
-- "Einzel Zählspiel nach Stableford") so almost everything fell through to
-- 'other', making the UI format filter return empty results.
--
-- This migration mirrors the new Python FORMAT_PATTERNS priority list in
-- SQL and walks every available raw_data signal per source, picking the
-- first match.

CREATE OR REPLACE FUNCTION _classify_format(raw TEXT) RETURNS TEXT AS $$
DECLARE
  s TEXT;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := lower(raw);
  IF s = '' THEN RETURN NULL; END IF;

  IF s LIKE '%texas scramble%' OR s LIKE '%texas-scramble%' THEN RETURN 'texas_scramble';
  ELSIF s LIKE '%chapman%' THEN RETURN 'chapman';
  ELSIF s LIKE '%best ball%' OR s LIKE '%best-ball%' OR s LIKE '%bestball%' THEN RETURN 'best_ball';
  ELSIF s LIKE '%scramble%' THEN RETURN 'scramble';
  ELSIF s LIKE '%vierer%' OR s LIKE '%foursome%' THEN RETURN 'vierer';
  ELSIF s LIKE '%matchplay%' OR s LIKE '%match play%' OR s LIKE '%lochspiel%' THEN RETURN 'matchplay';
  ELSIF s LIKE '%stableford%' THEN RETURN 'stableford';
  ELSIF s LIKE '%strokeplay%' OR s LIKE '%stroke play%' OR s LIKE '%zählspiel%' OR s LIKE '%zaehlspiel%' THEN RETURN 'strokeplay';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Only touch rows the old normalizer couldn't place.
-- COALESCE ends with `format` so we never blank a row we can't reclassify.
UPDATE tournaments
SET format = COALESCE(
  _classify_format(raw_data->'round_types'->>0),
  _classify_format(raw_data->>'spielform'),
  _classify_format(raw_data->>'wertungsart'),
  _classify_format(raw_data->>'turnierart'),
  _classify_format(name),
  format
)
WHERE format = 'other' OR format IS NULL;

DROP FUNCTION _classify_format(TEXT);
