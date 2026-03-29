"""Deduplicate golf clubs by normalized name similarity.

Merges duplicate clubs:
- Picks the most complete record as the keeper (most non-null fields)
- Fills missing fields on keeper from duplicates
- Migrates tournament references (club_id) to keeper
- Migrates saved_clubs references to keeper
- Deletes duplicate records
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import Database


def normalize_name(name: str) -> str:
    """Normalize a club name for comparison."""
    n = name.strip()
    # Remove common suffixes
    n = re.sub(r'\s+e\.\s*V\.?\s*$', '', n, flags=re.I)
    # Normalize "Golf Club" / "Golf-Club" / "Golfclub"
    n = re.sub(r'Golf[\s\-]*Club', 'Golfclub', n, flags=re.I)
    # Normalize "GC " prefix
    n = re.sub(r'^GC\s+', 'Golfclub ', n, flags=re.I)
    # Normalize "GLC " prefix
    n = re.sub(r'^GLC\s+', 'Golf & Landclub ', n, flags=re.I)
    # Normalize "GCC " prefix
    n = re.sub(r'^GCC\s+', 'Golf & Country Club ', n, flags=re.I)
    # Remove extra whitespace
    n = re.sub(r'\s+', ' ', n).strip()
    # Lowercase for comparison
    return n.lower()


def completeness_score(club: dict) -> int:
    """Count non-null, non-empty fields — higher is more complete."""
    important_fields = [
        'name', 'address', 'city', 'postal_code', 'region',
        'latitude', 'longitude', 'website', 'phone', 'email',
        'logo_url', 'pccaddie_id', 'courses',
    ]
    score = 0
    for f in important_fields:
        val = club.get(f)
        if val is not None and val != '' and val != []:
            score += 1
    # Bonus for having tournaments linked
    return score


def merge_fields(keeper: dict, duplicate: dict) -> dict:
    """Fill missing fields on keeper from duplicate. Return updates dict."""
    updates = {}
    # Fields to fill if missing on keeper
    fillable = [
        'address', 'city', 'postal_code', 'region',
        'latitude', 'longitude', 'website', 'phone', 'email',
        'logo_url', 'pccaddie_id', 'courses', 'has_9_holes', 'has_18_holes',
    ]
    for f in fillable:
        keeper_val = keeper.get(f)
        dup_val = duplicate.get(f)
        if (keeper_val is None or keeper_val == '' or keeper_val == []) and dup_val:
            updates[f] = dup_val
    return updates


def main():
    db = Database()
    clubs = db.get_all_clubs()
    print(f"Total clubs: {len(clubs)}\n")

    # Group by normalized name
    groups: dict[str, list[dict]] = defaultdict(list)
    for club in clubs:
        key = normalize_name(club['name'])
        groups[key].append(club)

    # Find duplicates
    dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
    if not dup_groups:
        print("No duplicates found!")
        return

    print(f"Found {len(dup_groups)} duplicate groups:\n")

    total_removed = 0
    total_tournaments_migrated = 0

    for norm_name, dupes in sorted(dup_groups.items()):
        print(f"--- {norm_name} ({len(dupes)} entries) ---")
        for d in dupes:
            score = completeness_score(d)
            print(f"  [{score:2d} fields] {d['name']} | city={d.get('city')} | id={d['id']}")

        # Pick keeper: most complete, then most recent
        dupes_sorted = sorted(dupes, key=lambda c: (completeness_score(c), c.get('updated_at', '')), reverse=True)
        keeper = dupes_sorted[0]
        to_remove = dupes_sorted[1:]

        print(f"  → Keeping: {keeper['name']} (id={keeper['id']})")

        for dup in to_remove:
            # Merge missing fields
            updates = merge_fields(keeper, dup)
            if updates:
                updates['updated_at'] = 'now()'
                db.client.table('golf_clubs').update(updates).eq('id', keeper['id']).execute()
                print(f"  → Merged {len(updates)-1} fields from {dup['name']}")

            # Migrate tournaments — delete duplicates that would conflict, then migrate the rest
            dup_tournaments = db.client.table('tournaments').select(
                'id,name,date_start,source'
            ).eq('club_id', dup['id']).execute()
            dup_t_list = dup_tournaments.data or []

            if dup_t_list:
                # Find which tournaments already exist under the keeper
                keeper_tournaments = db.client.table('tournaments').select(
                    'name,date_start,source'
                ).eq('club_id', keeper['id']).execute()
                keeper_keys = {
                    (t['name'], t['date_start'], t['source'])
                    for t in (keeper_tournaments.data or [])
                }

                # Delete dup tournaments that would conflict
                conflicts = [
                    t for t in dup_t_list
                    if (t['name'], t['date_start'], t['source']) in keeper_keys
                ]
                if conflicts:
                    conflict_ids = [t['id'] for t in conflicts]
                    db.client.table('tournaments').delete().in_('id', conflict_ids).execute()
                    print(f"  → Removed {len(conflicts)} conflicting tournaments from {dup['name']}")

                # Migrate remaining
                remaining = len(dup_t_list) - len(conflicts)
                if remaining > 0:
                    t_res = db.client.table('tournaments').update(
                        {'club_id': keeper['id']}
                    ).eq('club_id', dup['id']).execute()
                    migrated = len(t_res.data) if t_res.data else 0
                    if migrated:
                        print(f"  → Migrated {migrated} tournaments from {dup['id']}")
                        total_tournaments_migrated += migrated

            # Migrate saved_clubs (ignore conflicts — user might already have keeper saved)
            try:
                db.client.table('saved_clubs').update(
                    {'club_id': keeper['id']}
                ).eq('club_id', dup['id']).execute()
            except Exception:
                # Conflict means user already has keeper saved, just delete the old reference
                db.client.table('saved_clubs').delete().eq('club_id', dup['id']).execute()

            # Delete duplicate
            db.client.table('golf_clubs').delete().eq('id', dup['id']).execute()
            print(f"  ✗ Deleted: {dup['name']} (id={dup['id']})")
            total_removed += 1

        print()

    print(f"=== Done. Removed {total_removed} duplicates, migrated {total_tournaments_migrated} tournaments. ===")


if __name__ == '__main__':
    main()
