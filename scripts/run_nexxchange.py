"""Scrape tournaments from Nexxchange club calendars."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.nexxchange import NexxchangeScraper


def main():
    print("=== Scraping Nexxchange Tournaments ===\n")
    with NexxchangeScraper() as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
