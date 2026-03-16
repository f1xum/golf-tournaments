"""LLM-assisted generic club website scraper.

For any golf club website, this scraper:
1. Fetches the tournament/events page
2. Sends HTML to Claude API for structured extraction
3. Validates with Pydantic and upserts to database
"""

from bs4 import BeautifulSoup

from src.models.tournament import Tournament, TournamentSource
from src.parsers.llm_extractor import extract_tournaments_with_llm
from src.scrapers.base import BaseScraper
from src.scrapers.clubs.registry import get_all_configured_clubs, get_club_config


class ClubWebsiteScraper(BaseScraper):
    source_name = "club_website"

    def __init__(self, club_names: list[str] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.club_names = club_names

    def run(self) -> None:
        # Determine which clubs to scrape
        if self.club_names:
            configs = {}
            for name in self.club_names:
                cfg = get_club_config(name)
                if cfg:
                    configs[name] = cfg
                else:
                    print(f"  ⚠ No config for club: {name}")
        else:
            configs = get_all_configured_clubs()

        # Load clubs from DB for ID matching
        all_clubs = self.db.get_all_clubs()
        club_by_name = {c["name"]: c for c in all_clubs}

        total_found = 0
        total_created = 0

        for club_name, config in configs.items():
            url = config["tournament_url"]
            print(f"\n[Club] Scraping {club_name}: {url}")

            try:
                html = self.fetch(url)
            except Exception as e:
                error_msg = f"Failed to fetch {url}: {e}"
                print(f"  ✗ {error_msg}")
                if hasattr(self, "_ctx"):
                    self._ctx.errors.append(error_msg)
                continue

            # Clean HTML: remove nav, footer, scripts to reduce noise
            cleaned_text = self._clean_html(html)

            if len(cleaned_text.strip()) < 50:
                print(f"  ⚠ Page appears empty or too short, skipping")
                continue

            # Send to LLM for extraction
            print(f"  → Sending to Claude API for extraction...")
            raw_tournaments = extract_tournaments_with_llm(cleaned_text)
            print(f"  → LLM extracted {len(raw_tournaments)} tournaments")
            total_found += len(raw_tournaments)

            # Match club
            club = self._find_club(club_name, club_by_name)
            club_id = club["id"] if club else None

            # Convert to Tournament models and upsert
            rows = []
            for raw in raw_tournaments:
                try:
                    t = Tournament(
                        name=raw.get("name", "Unknown Tournament"),
                        date_start=raw["date_start"],
                        date_end=raw.get("date_end"),
                        format=raw.get("format"),
                        rounds=raw.get("rounds"),
                        max_handicap=raw.get("max_handicap"),
                        entry_fee=raw.get("entry_fee"),
                        age_class=raw.get("age_class"),
                        description=raw.get("description"),
                        registration_url=raw.get("registration_url"),
                        source=TournamentSource.CLUB_WEBSITE,
                        source_url=url,
                        raw_data=raw,
                    )
                    row = t.to_db_row()
                    if club_id:
                        row["club_id"] = club_id
                    rows.append(row)
                except Exception as e:
                    print(f"  ⚠ Invalid tournament data: {e}")
                    if hasattr(self, "_ctx"):
                        self._ctx.errors.append(f"{club_name}: {e}")

            if rows:
                self.db.upsert_tournaments(rows)
                total_created += len(rows)
                print(f"  ✓ {len(rows)} tournaments upserted for {club_name}")

        if hasattr(self, "_ctx"):
            self._ctx.items_found = total_found
            self._ctx.items_created = total_created

        print(f"\n[Club] Done. {total_found} found, {total_created} upserted.")

    def _clean_html(self, html: str) -> str:
        """Strip nav, footer, scripts, and return readable text."""
        soup = BeautifulSoup(html, "html.parser")

        # Remove noise elements
        for tag in soup.find_all(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()

        # Try to find a main content area
        main = soup.find("main") or soup.find("article") or soup.find(id="content")
        if main:
            return main.get_text(separator="\n", strip=True)

        return soup.get_text(separator="\n", strip=True)

    def _find_club(self, club_name: str, club_by_name: dict) -> dict | None:
        if club_name in club_by_name:
            return club_by_name[club_name]
        name_lower = club_name.lower()
        for name, club in club_by_name.items():
            if name_lower in name.lower() or name.lower() in name_lower:
                return club
        return self.db.find_club_by_name(club_name)
