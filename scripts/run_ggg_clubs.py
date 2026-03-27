"""Scrape all German golf clubs from german-golf-guide.de."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.ggg_clubs import GGGClubsScraper


def main():
    print("=== Scraping German Golf Guide — All Clubs ===\n")
    with GGGClubsScraper() as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
