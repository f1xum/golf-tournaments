"""Cross-source tournament deduplication.

When the same tournament appears in both BGV and a club website, we want to
link them rather than creating separate entries. The DB UNIQUE constraint
prevents exact duplicates within a single source, but cross-source dedup
requires fuzzy matching.
"""

from datetime import date, timedelta

from src.database import Database


def deduplicate_tournaments(db: Database | None = None) -> int:
    """Find and merge cross-source duplicates.

    Strategy: For each club_website tournament, check if a BGV/DGV tournament
    exists with the same club, overlapping dates, and a similar name.

    Returns the number of duplicates removed.
    """
    db = db or Database()
    removed = 0

    # Get all club_website tournaments
    club_tournaments = db.get_tournaments(source="club_website")

    # Get all BGV/DGV tournaments indexed by club_id + date
    official_tournaments = db.get_tournaments(source="bgv") + db.get_tournaments(source="dgv")
    official_index: dict[str, list[dict]] = {}
    for t in official_tournaments:
        key = t.get("club_id", "")
        if key:
            official_index.setdefault(key, []).append(t)

    for club_t in club_tournaments:
        club_id = club_t.get("club_id")
        if not club_id or club_id not in official_index:
            continue

        for official_t in official_index[club_id]:
            if _is_duplicate(club_t, official_t):
                # Keep the official source, remove the club_website version
                print(
                    f"  Dedup: removing club_website '{club_t['name']}' "
                    f"(matches {official_t['source']} '{official_t['name']}')"
                )
                db.client.table("tournaments").delete().eq("id", club_t["id"]).execute()
                removed += 1
                break

    print(f"[Dedup] Removed {removed} cross-source duplicates.")
    return removed


def _is_duplicate(a: dict, b: dict) -> bool:
    """Check if two tournaments are likely the same event."""
    # Dates must overlap or be within 1 day
    a_start = _parse_date(a.get("date_start"))
    b_start = _parse_date(b.get("date_start"))
    if not a_start or not b_start:
        return False
    if abs((a_start - b_start).days) > 1:
        return False

    # Names must be similar
    return _name_similarity(a.get("name", ""), b.get("name", "")) > 0.6


def _name_similarity(a: str, b: str) -> float:
    """Simple word-overlap similarity between two tournament names."""
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())

    # Remove common filler words
    fillers = {"e.v.", "gc", "golf", "club", "golfclub", "turnier", "open", "cup", "-", "–"}
    words_a -= fillers
    words_b -= fillers

    if not words_a or not words_b:
        return 0.0

    overlap = words_a & words_b
    return len(overlap) / max(len(words_a), len(words_b))


def _parse_date(val) -> date | None:
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        try:
            return date.fromisoformat(val)
        except ValueError:
            return None
    return None
