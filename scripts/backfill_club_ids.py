"""Backfill club_id on tournaments that have NULL club_id.

This script:
1. Cleans up NULL duplicates where a matched version already exists
2. Matches remaining NULL club_id tournaments to clubs using:
   - pccaddie_id extracted from source_url (for club_website source)
   - Normalized venue name matching (for bgv/dgv sources)
3. Reports unmatched venues for debugging
"""

import re
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

    # Build pccaddie_id → club lookup
    pccaddie_to_club = {}
    for c in clubs:
        if c.get("pccaddie_id"):
            pccaddie_to_club[c["pccaddie_id"]] = c

    # Build nexxchange_id → club lookup
    nexxchange_to_club = {}
    for c in clubs:
        if c.get("nexxchange_id"):
            nexxchange_to_club[c["nexxchange_id"]] = c

    print(f"Index: {len(club_index)} names, {len(pccaddie_to_club)} pccaddie, {len(nexxchange_to_club)} nexxchange")

    # Step 1: Clean up NULL duplicates
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
            db.client.table("tournaments").delete().eq("id", t["id"]).execute()
            deleted += 1

    print(f"Deleted {deleted} NULL duplicates")

    # Step 2: Match remaining NULL club_id tournaments
    print("\n--- Step 2: Matching remaining tournaments ---")
    remaining = []
    offset = 0
    while True:
        result = (
            db.client.table("tournaments")
            .select("id,name,description,raw_data,source,source_url")
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
    matched_by_method: dict[str, int] = {"pccaddie_id": 0, "venue_name": 0}
    failed_venues: dict[str, int] = {}

    for t in remaining:
        club = None
        source_url = t.get("source_url") or ""

        # Method 1: Extract pccaddie_id from source_url
        if not club and "pccaddie.net/clubs/" in source_url:
            pcc_match = re.search(r"/clubs/(\d+)/", source_url)
            if pcc_match:
                pcc_id = pcc_match.group(1)
                club = pccaddie_to_club.get(pcc_id)
                if club:
                    matched_by_method["pccaddie_id"] += 1

        # Method 2: Venue name matching
        if not club:
            venue = None
            raw = t.get("raw_data") or {}

            if t.get("description"):
                venue = t["description"]
            elif raw.get("venue"):
                venue = raw["venue"]

            if venue:
                club = match_club_name(venue, club_index, clubs_by_name)
                if not club:
                    club = db.find_club_by_name(venue)
                if club:
                    matched_by_method["venue_name"] += 1
                else:
                    failed_venues[venue] = failed_venues.get(venue, 0) + 1

        if club:
            try:
                db.client.table("tournaments").update(
                    {"club_id": club["id"]}
                ).eq("id", t["id"]).execute()
                matched += 1
            except Exception:
                db.client.table("tournaments").delete().eq("id", t["id"]).execute()
                deleted += 1

    print(f"\n=== Results ===")
    print(f"Duplicates cleaned: {deleted}")
    print(f"Newly matched: {matched}")
    for method, count in matched_by_method.items():
        print(f"  by {method}: {count}")
    print(f"Still unmatched: {len(remaining) - matched}")

    if failed_venues:
        print(f"\nTop unmatched venues:")
        sorted_venues = sorted(failed_venues.items(), key=lambda x: -x[1])
        for venue, count in sorted_venues[:30]:
            print(f"  {count:4d}x  {venue}")


if __name__ == "__main__":
    main()
