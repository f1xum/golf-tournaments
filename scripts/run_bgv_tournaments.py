"""Scrape BGV tournament calendar."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.bgv_tournaments import BGVTournamentsScraper


def main():
    print("=== Scraping BGV Tournaments ===\n")
    with BGVTournamentsScraper() as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
