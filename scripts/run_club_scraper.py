"""Scrape tournament data from individual club websites using LLM extraction."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.scrapers.club_website import ClubWebsiteScraper


def main():
    # Optional: pass specific club names as CLI args
    club_names = sys.argv[1:] if len(sys.argv) > 1 else None

    print("=== Scraping Club Websites ===\n")
    with ClubWebsiteScraper(club_names=club_names) as scraper:
        scraper.run_with_logging()


if __name__ == "__main__":
    main()
