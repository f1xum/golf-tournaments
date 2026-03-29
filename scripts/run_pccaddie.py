"""Scrape tournaments from PC CADDIE club calendars.

Usage:
  python scripts/run_pccaddie.py                     # all regions
  python scripts/run_pccaddie.py Bayern               # single region
  python scripts/run_pccaddie.py Bayern Baden-Württemberg  # multiple regions
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.pccaddie import PCCaddieScraper


def main():
    regions = sys.argv[1:] if len(sys.argv) > 1 else None
    label = ", ".join(regions) if regions else "all regions"
    print(f"=== Scraping PC CADDIE Tournaments ({label}) ===\n")
    with PCCaddieScraper(regions=regions) as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
