"""Scrape tournaments from the BGV tournament calendar."""

import re
from datetime import date, datetime

from bs4 import BeautifulSoup, Tag

from src.config import settings
from src.models.tournament import Tournament, TournamentFormat, TournamentSource
from src.scrapers.base import BaseScraper


class BGVTournamentsScraper(BaseScraper):
    source_name = "bgv_tournaments"

    def run(self) -> None:
        url = f"{settings.bgv_base_url}{settings.bgv_tournaments_path}"
        print(f"[BGV Tournaments] Fetching: {url}")

        html = self.fetch(url)
        tournaments = self._parse_tournaments(html)

        print(f"[BGV Tournaments] Found {len(tournaments)} tournaments.")

        # Match venues to clubs in the database
        clubs = {c["name"]: c for c in self.db.get_all_clubs()}

        rows = []
        for t in tournaments:
            row = t.to_db_row()
            # Try to match venue to a club
            if t.description:
                club = self._match_club(t.description, clubs)
                if club:
                    row["club_id"] = club["id"]
            rows.append(row)

        if rows:
            self.db.upsert_tournaments(rows)

        if hasattr(self, "_ctx"):
            self._ctx.items_found = len(tournaments)
            self._ctx.items_created = len(tournaments)

        print(f"[BGV Tournaments] Done. {len(tournaments)} tournaments upserted.")

    def _parse_tournaments(self, html: str) -> list[Tournament]:
        soup = BeautifulSoup(html, "html.parser")
        tournaments: list[Tournament] = []

        # Each tournament is a div with class "bgvTurnier"
        for block in soup.find_all("div", class_="bgvTurnier"):
            try:
                tournament = self._parse_single_tournament(block)
                if tournament:
                    tournaments.append(tournament)
            except Exception as e:
                print(f"  ⚠ Failed to parse tournament: {e}")
                if hasattr(self, "_ctx"):
                    self._ctx.errors.append(str(e))

        return tournaments

    def _parse_single_tournament(self, block: Tag) -> Tournament | None:
        # Name from h4 inside turnierHeader
        header = block.find("div", class_="turnierHeader")
        h4 = header.find("h4") if header else None
        name = h4.get_text(strip=True) if h4 else None
        if not name:
            return None

        # Venue from turnierGolfclub div
        venue_div = block.find("div", class_="turnierGolfclub")
        venue = venue_div.get_text(strip=True) if venue_div else None

        # Dates from turnierDate div
        date_div = block.find("div", class_="turnierDate")
        date_start, date_end = None, None
        if date_div:
            date_text = date_div.get_text(separator=" ", strip=True)
            date_start, date_end = self._extract_dates(date_text)
        if not date_start:
            return None

        # Extract info fields from turnierInfo divs
        info_fields: dict[str, str] = {}
        for info in block.find_all("div", class_="turnierInfo"):
            label_el = info.find("span", class_="turnierInfoLabel")
            value_el = info.find("span", class_="turnierInfoValue")
            if label_el and value_el:
                label = label_el.get_text(strip=True).rstrip(":")
                value = value_el.get_text(strip=True)
                info_fields[label] = value

        rounds = info_fields.get("Anzahl Runden")
        format_str = info_fields.get("Wertungsart")
        age_class = info_fields.get("Altersklasse")
        turnierart = info_fields.get("Turnierart")
        teilnehmer = info_fields.get("Teilnehmer")

        # Meldeschluss (registration deadline)
        meldeschluss = None
        ms_div = block.find("div", class_="turnierMeldeschluss")
        if ms_div:
            meldeschluss = ms_div.get_text(strip=True)

        source_url = f"{settings.bgv_base_url}{settings.bgv_tournaments_path}"

        return Tournament(
            name=name,
            date_start=date_start,
            date_end=date_end,
            format=format_str,
            rounds=int(rounds) if rounds else None,
            age_class=age_class,
            gender=teilnehmer,
            description=venue,
            source=TournamentSource.BGV,
            source_url=source_url,
            raw_data={
                "venue": venue,
                "turnierart": turnierart,
                "meldeschluss": meldeschluss,
            },
        )

    def _extract_dates(self, text: str) -> tuple[date | None, date | None]:
        """Extract date range from text like '17.04.2026 - 19.04.2026' or '02.05.2026'."""
        # Range pattern
        range_match = re.search(
            r"(\d{1,2})\.(\d{2})\.(\d{4})\s*[-–]\s*(\d{1,2})\.(\d{2})\.(\d{4})",
            text,
        )
        if range_match:
            d1, m1, y1, d2, m2, y2 = range_match.groups()
            start = date(int(y1), int(m1), int(d1))
            end = date(int(y2), int(m2), int(d2))
            return start, end

        # Single date
        single_match = re.search(r"(\d{1,2})\.(\d{2})\.(\d{4})", text)
        if single_match:
            d, m, y = single_match.groups()
            dt = date(int(y), int(m), int(d))
            return dt, dt

        return None, None

    def _extract_field(self, text: str, pattern: str) -> str | None:
        match = re.search(pattern, text)
        return match.group(1).strip() if match else None

    def _match_club(self, venue_name: str, clubs: dict[str, dict]) -> dict | None:
        """Try to match a venue name to a club in the database."""
        # Direct match
        if venue_name in clubs:
            return clubs[venue_name]

        # Fuzzy: check if venue is contained in any club name or vice versa
        venue_lower = venue_name.lower()
        for club_name, club in clubs.items():
            if venue_lower in club_name.lower() or club_name.lower() in venue_lower:
                return club

        # Fallback: DB fuzzy search
        return self.db.find_club_by_name(venue_name)
