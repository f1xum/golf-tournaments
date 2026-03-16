"""Scrape DGV tournament calendar from PDF downloads."""

import tempfile
from pathlib import Path

from src.models.tournament import Tournament, TournamentSource
from src.parsers.llm_extractor import extract_tournaments_with_llm
from src.parsers.pdf_parser import extract_tournaments_from_pdf
from src.scrapers.base import BaseScraper

# Known DGV PDF calendar URLs (update annually)
DGV_CALENDAR_URLS = [
    "https://serviceportal.dgv-intranet.de/files/pdf1/turnierkalender-2026.pdf",
]

# Bavarian regions / keywords to filter tournaments
BAVARIA_KEYWORDS = [
    "bayern", "bayerisch", "bgv", "münchen", "munich", "nürnberg", "nuremberg",
    "augsburg", "regensburg", "würzburg", "ingolstadt", "passau", "rosenheim",
    "oberbayern", "niederbayern", "schwaben", "oberpfalz", "oberfranken",
    "mittelfranken", "unterfranken",
]


class DGVTournamentsScraper(BaseScraper):
    source_name = "dgv_tournaments"

    def __init__(self, pdf_urls: list[str] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.pdf_urls = pdf_urls or DGV_CALENDAR_URLS

    def run(self) -> None:
        all_tournaments: list[Tournament] = []

        for url in self.pdf_urls:
            print(f"[DGV] Downloading PDF: {url}")
            try:
                pdf_bytes = self.fetch_bytes(url)
            except Exception as e:
                error_msg = f"Failed to download {url}: {e}"
                print(f"  ✗ {error_msg}")
                if hasattr(self, "_ctx"):
                    self._ctx.errors.append(error_msg)
                continue

            # Save to temp file for pdfplumber
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(pdf_bytes)
                pdf_path = Path(f.name)

            # Try structured extraction first
            print("[DGV] Extracting with pdfplumber...")
            raw_tournaments = extract_tournaments_from_pdf(pdf_path)

            if not raw_tournaments:
                # Fallback: send raw text to LLM
                print("[DGV] pdfplumber found no data, falling back to LLM extraction...")
                import pdfplumber

                with pdfplumber.open(pdf_path) as pdf:
                    full_text = "\n".join(
                        page.extract_text() or "" for page in pdf.pages
                    )
                if full_text.strip():
                    raw_tournaments = extract_tournaments_with_llm(full_text)

            pdf_path.unlink(missing_ok=True)

            # Filter for Bavarian tournaments
            for raw in raw_tournaments:
                if not self._is_bavarian(raw):
                    continue

                try:
                    tournament = self._raw_to_tournament(raw, url)
                    if tournament:
                        all_tournaments.append(tournament)
                except Exception as e:
                    if hasattr(self, "_ctx"):
                        self._ctx.errors.append(f"Parse error: {e}")

        print(f"[DGV] Found {len(all_tournaments)} Bavarian tournaments.")

        # Match venues to clubs and upsert
        clubs = {c["name"]: c for c in self.db.get_all_clubs()}
        rows = []
        for t in all_tournaments:
            row = t.to_db_row()
            if t.raw_data and t.raw_data.get("venue"):
                club = self._match_club(t.raw_data["venue"], clubs)
                if club:
                    row["club_id"] = club["id"]
            rows.append(row)

        if rows:
            self.db.upsert_tournaments(rows)

        if hasattr(self, "_ctx"):
            self._ctx.items_found = len(all_tournaments)
            self._ctx.items_created = len(all_tournaments)

        print(f"[DGV] Done. {len(all_tournaments)} tournaments upserted.")

    def _is_bavarian(self, raw: dict) -> bool:
        """Check if a tournament is in Bavaria based on venue/name."""
        searchable = " ".join(
            str(v) for v in raw.values() if v
        ).lower()
        return any(kw in searchable for kw in BAVARIA_KEYWORDS)

    def _raw_to_tournament(self, raw: dict, source_url: str) -> Tournament | None:
        name = raw.get("name")
        date_start = raw.get("date_start")
        if not name or not date_start:
            return None

        return Tournament(
            name=name,
            date_start=date_start,
            date_end=raw.get("date_end"),
            format=raw.get("format"),
            rounds=raw.get("rounds"),
            max_handicap=raw.get("max_handicap"),
            entry_fee=raw.get("entry_fee"),
            age_class=raw.get("age_class"),
            description=raw.get("description"),
            source=TournamentSource.DGV,
            source_url=source_url,
            raw_data=raw,
        )

    def _match_club(self, venue_name: str, clubs: dict[str, dict]) -> dict | None:
        venue_lower = venue_name.lower()
        for club_name, club in clubs.items():
            if venue_lower in club_name.lower() or club_name.lower() in venue_lower:
                return club
        return self.db.find_club_by_name(venue_name)
