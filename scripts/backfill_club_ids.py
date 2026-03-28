"""Backfill club_id on tournaments that have NULL club_id.

This script:
1. Loads all clubs from the database
2. Finds tournaments with NULL club_id
3. Matches them to clubs using normalized name matching
4. For matched tournaments: if a duplicate row already exists with the same
   (name, date_start, source) and a real club_id, deletes the NULL row.
   Otherwise updates the NULL row with the matched club_id.
5. Reports unmatched venues for debugging
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.club_matching import build_club_index, match_club_name
from src.database import Database


def main():
    db = Database()

    # Load all clubs
    clubs = db.get_all_clubs()
    print(f"Loaded {len(clubs)} clubs from database")

    clubs_by_name = {c["name"]: c for c in clubs}
    club_index = build_club_index(clubs)
    print(f"Built index with {len(club_index)} normalized entries")

    # Step 1: Clean up NULL duplicates — rows where the same tournament
    # exists both with NULL club_id and with a real club_id
    print("\n--- Step 1: Cleaning up NULL club_id duplicates ---")
    all_null = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            db.client.table("tournaments")
            .select("id,name,date_start,source")
            .is_("club_id", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data
        if not batch:
            break
        all_null.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"Found {len(all_null)} tournaments with NULL club_id")

    deleted = 0
    for t in all_null:
        # Check if a version with club_id exists
        existing = (
            db.client.table("tournaments")
            .select("id")
            .eq("name", t["name"])
            .eq("date_start", t["date_start"])
            .eq("source", t["source"])
            .not_.is_("club_id", "null")
            .limit(1)
            .execute()
        )
        if existing.data:
            # A matched version exists — delete the NULL duplicate
            db.client.table("tournaments").delete().eq("id", t["id"]).execute()
            deleted += 1

    print(f"Deleted {deleted} NULL duplicates (matched version already exists)")

    # Step 2: Match remaining NULL club_id tournaments
    print("\n--- Step 2: Matching remaining tournaments ---")
    remaining = []
    offset = 0
    while True:
        result = (
            db.client.table("tournaments")
            .select("id,name,description,raw_data,source")
            .is_("club_id", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data
        if not batch:
            break
        remaining.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"Found {len(remaining)} tournaments still with NULL club_id")

    matched = 0
    failed_venues: dict[str, int] = {}

    for t in remaining:
        venue = None
        raw = t.get("raw_data") or {}

        if t.get("description"):
            venue = t["description"]
        elif raw.get("venue"):
            venue = raw["venue"]

        if not venue:
            continue

        club = match_club_name(venue, club_index, clubs_by_name)
        if not club:
            club = db.find_club_by_name(venue)

        if club:
            try:
                db.client.table("tournaments").update(
                    {"club_id": club["id"]}
                ).eq("id", t["id"]).execute()
                matched += 1
            except Exception:
                # Update would create a duplicate — a row with this
                # (name, date, club_id, source) already exists.
                # Delete the NULL row instead.
                db.client.table("tournaments").delete().eq("id", t["id"]).execute()
                deleted += 1
        else:
            failed_venues[venue] = failed_venues.get(venue, 0) + 1

    print(f"\n=== Results ===")
    print(f"Duplicates cleaned: {deleted}")
    print(f"Newly matched: {matched} / {len(remaining)}")
    print(f"Still unmatched: {len(remaining) - matched}")

    if failed_venues:
        print(f"\nTop unmatched venues:")
        sorted_venues = sorted(failed_venues.items(), key=lambda x: -x[1])
        for venue, count in sorted_venues[:30]:
            print(f"  {count:4d}x  {venue}")


if __name__ == "__main__":
    main()
