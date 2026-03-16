"""Scrape DGV tournament calendar (PDF)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.dgv_tournaments import DGVTournamentsScraper


def main():
    print("=== Scraping DGV Tournaments ===\n")
    with DGVTournamentsScraper() as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
