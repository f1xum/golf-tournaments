"""Backfill club_id on tournaments that have NULL club_id.

This script:
1. Loads all clubs from the database
2. Finds tournaments with NULL club_id
3. Attempts to match them to clubs using normalized name matching
4. Updates matched tournaments with the correct club_id
"""

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

    # Find tournaments with NULL club_id
    # Supabase paginates at 1000 by default, so we page through
    all_unmatched = []
    offset = 0
    page_size = 1000
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
        all_unmatched.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"\nFound {len(all_unmatched)} tournaments with NULL club_id")

    matched = 0
    failed_venues: dict[str, int] = {}

    for t in all_unmatched:
        # Try to extract venue name from different fields
        venue = None
        raw = t.get("raw_data") or {}

        # BGV: venue is in description field
        if t.get("description"):
            venue = t["description"]
        # DGV: venue in raw_data.venue
        elif raw.get("venue"):
            venue = raw["venue"]

        if not venue:
            continue

        club = match_club_name(venue, club_index, clubs_by_name)
        if not club:
            # Fallback: DB ilike search
            club = db.find_club_by_name(venue)

        if club:
            db.client.table("tournaments").update(
                {"club_id": club["id"]}
            ).eq("id", t["id"]).execute()
            matched += 1
        else:
            failed_venues[venue] = failed_venues.get(venue, 0) + 1

    print(f"\n=== Results ===")
    print(f"Matched: {matched} / {len(all_unmatched)} tournaments")
    print(f"Still unmatched: {len(all_unmatched) - matched}")

    if failed_venues:
        print(f"\nTop unmatched venues:")
        sorted_venues = sorted(failed_venues.items(), key=lambda x: -x[1])
        for venue, count in sorted_venues[:30]:
            print(f"  {count:4d}x  {venue}")


if __name__ == "__main__":
    main()
