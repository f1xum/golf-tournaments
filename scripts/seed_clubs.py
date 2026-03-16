"""Seed the database with all BGV golf clubs."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.bgv_clubs import BGVClubsScraper


def main():
    print("=== Seeding Golf Clubs from BGV ===\n")
    with BGVClubsScraper() as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
