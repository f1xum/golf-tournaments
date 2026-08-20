"""Strip scraper artefacts out of golf_clubs name/city text.

Two artefacts show up in the live data and both are user-visible:

  * Non-breaking spaces (U+00A0) inside names — 25 rows, e.g.
    "Golfclub\\xa0München-Riem\\xa0 e. V.". They render as odd double gaps and
    break naive name matching, because U+00A0 is not \\s in every engine.
  * Whole blocks of page furniture captured into `city` — 3 rows, e.g.
    "Velden\\nE-Mail schreiben\\nwww". The BGV club scraper grabbed the text
    node after the town instead of the town alone.

Both are cosmetic to fix and safe: only whitespace normalisation and truncation
at the first line break, never a change of meaning.

Usage:
    python scripts/clean_club_text_fields.py           # dry run
    python scripts/clean_club_text_fields.py --apply
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import Database


def clean(value: str | None) -> str | None:
    """Normalise a scraped text field, or None if it holds nothing usable."""
    if value is None:
        return None
    # Everything after the first newline is page furniture, not part of the
    # town name.
    text = value.split("\n")[0]
    # U+00A0 and friends collapse to ordinary spaces.
    text = text.replace("\xa0", " ").replace("​", "")
    text = " ".join(text.split())
    return text or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = ap.parse_args()

    db = Database()
    rows, start = [], 0
    while True:
        r = (db.client.table("golf_clubs").select("id,name,city")
             .range(start, start + 999).execute())
        rows += r.data
        if len(r.data) < 1000:
            break
        start += 1000

    changes = []
    for row in rows:
        update = {}
        for field in ("name", "city"):
            cleaned = clean(row[field])
            if cleaned != row[field]:
                update[field] = cleaned
        if update:
            changes.append((row, update))

    for row, update in changes:
        for field, value in update.items():
            print(f"  {field}: {row[field]!r}\n      -> {value!r}")

    print(f"\n{len(changes)} clubs need cleaning.")
    if args.apply:
        for row, update in changes:
            db.client.table("golf_clubs").update(update).eq("id", row["id"]).execute()
        print(f"Wrote {len(changes)} clubs.")
    else:
        print("DRY RUN — nothing written. Re-run with --apply.")


if __name__ == "__main__":
    main()
