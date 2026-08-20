"""Extract tournaments from clubs' published PDF Wettspielkalender.

For clubs with no readable tournament feed — chiefly the Albatros ones, whose
API needs authentication — the club's own PDF calendar is the source.

Usage:
    python scripts/run_club_pdf_calendars.py
    python scripts/run_club_pdf_calendars.py --club <uuid>   # one club
    python scripts/run_club_pdf_calendars.py --year 2027
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.club_pdf_calendar import ClubPDFCalendarScraper


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--club", action="append", dest="clubs",
                        help="limit to this club id (repeatable)")
    parser.add_argument("--year", type=int, help="calendar year (default: current)")
    args = parser.parse_args()

    print("=== Extracting club PDF tournament calendars ===\n")
    with ClubPDFCalendarScraper(year=args.year, club_ids=args.clubs) as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
