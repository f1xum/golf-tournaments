"""Scrape tournaments from PC CADDIE club calendars."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.pccaddie import PCCaddieScraper


def main():
    print("=== Scraping PC CADDIE Tournaments ===\n")
    with PCCaddieScraper() as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
