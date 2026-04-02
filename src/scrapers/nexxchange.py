"""Scrape tournaments from Nexxchange tournament calendars.

Nexxchange is the second most common tournament management system for German golf clubs.
API: https://www.nexxchange.com/api/widget/tournaments/de/{issuerId}?format=json0&date=...&to=...

Returns structured JSON with tournament details.
"""

import re
from datetime import date, timedelta

from src.models.tournament import Tournament, TournamentSource
from src.scrapers.base import BaseScraper


NEXXCHANGE_API = "https://www.nexxchange.com/api/widget/tournaments/de"


class NexxchangeScraper(BaseScraper):
    source_name = "nexxchange"

    def run(self) -> None:
        # Load all clubs with a nexxchange_id from the database
        clubs = self.db.get_clubs_with_nexxchange_id()
        print(f"[Nexxchange] Scraping tournaments for {len(clubs)} clubs.")

        all_clubs_db = {c["name"]: c for c in self.db.get_all_clubs()}
        total_found = 0
        total_created = 0

        today = date.today()
        date_from = today.strftime("%-d.%-m.%Y")
        date_to = (today + timedelta(days=365)).strftime("%-d.%-m.%Y")

        for club in clubs:
            club_name = club["name"]
            issuer_id = club["nexxchange_id"]
            club_id = club["id"]

            api_url = (
                f"{NEXXCHANGE_API}/{issuer_id}"
                f"?format=json0&date={date_from}&to={date_to}"
            )
            print(f"\n[Nexxchange] {club_name} ({issuer_id})")

            try:
                response = self.http_client.get(api_url)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                print(f"  ✗ API error: {e}")
                if hasattr(self, "_ctx"):
                    self._ctx.errors.append(f"{club_name}: {e}")
                continue

            tournament_entries = data.get("tournaments", [])
            print(f"  Found {len(tournament_entries)} tournaments")
            total_found += len(tournament_entries)

            rows = []
            for entry in tournament_entries:
                try:
                    tournament = self._parse_tournament(entry, club_id)
                    if tournament:
                        row = tournament.to_db_row()
                        row["club_id"] = str(club_id)
                        rows.append(row)
                        print(f"    ✓ {tournament.name} ({tournament.date_start})")
                except Exception as e:
                    print(f"    ✗ Parse error: {e}")
                    if hasattr(self, "_ctx"):
                        self._ctx.errors.append(f"{club_name}: {e}")

            # Deduplicate and upsert
            seen = set()
            unique_rows = []
            for row in rows:
                key = (row.get("name"), row.get("date_start"), row.get("club_id"), row.get("source"))
                if key not in seen:
                    seen.add(key)
                    unique_rows.append(row)

            for row in unique_rows:
                try:
                    self.db.upsert_tournament(row)
                except Exception as e:
                    print(f"    ⚠ Upsert failed for {row.get('name')}: {e}")
                    if hasattr(self, "_ctx"):
                        self._ctx.errors.append(f"Upsert: {row.get('name')}: {e}")
            total_created += len(unique_rows)

        if hasattr(self, "_ctx"):
            self._ctx.items_found = total_found
            self._ctx.items_created = total_created

        print(f"\n[Nexxchange] Done. {total_found} found, {total_created} upserted.")

    def _parse_tournament(self, entry: dict, club_id: str) -> Tournament | None:
        """Parse a Nexxchange API tournament entry."""
        t = entry.get("tournament", {})
        round_types = entry.get("roundTypes", [])

        name = t.get("displayName")
        if not name:
            return None

        # Parse date: "04. April 2026" or ISO format
        date_start = self._parse_date(t.get("date", ""))
        if not date_start:
            return None

        # Format from roundTypes: ["Texas Scramble (Stableford - 2 Spieler)"]
        format_str = None
        if round_types:
            format_str = round_types[0]

        # HCP range
        max_hcp = self._parse_hcp(t.get("hcpFrom"))
        min_hcp = self._parse_hcp(t.get("hcpUntil"))

        # Entry fee
        entry_fee = None
        fee_val = entry.get("fee") or t.get("fee") or t.get("entryFee")
        if fee_val is not None:
            try:
                entry_fee = float(str(fee_val).replace(",", ".").replace("€", "").strip())
            except (ValueError, TypeError):
                pass

        # HCP relevant — derive from tournament properties
        hcp_relevant = bool(t.get("hcpRelevant") or t.get("handicapRelevant"))

        # Free slots
        player_count = t.get("playerCount")
        active = t.get("active")
        remaining = t.get("remaining")

        # Registration
        show_link = entry.get("showTournamentLink", "")
        reg_link = entry.get("registrationLink", "")

        # Scope: Public / Members Only
        scope = t.get("scope", "")
        guests_allowed = scope.lower() == "public" if scope else None

        return Tournament(
            name=name,
            date_start=date_start,
            format=format_str,
            rounds=1,
            max_handicap=max_hcp,
            min_handicap=min_hcp,
            entry_fee=entry_fee,
            description=t.get("description"),
            registration_url=reg_link or None,
            source=TournamentSource.NEXXCHANGE,
            source_url=show_link or None,
            raw_data={
                "nexxchange_id": t.get("id"),
                "nexxchange_number": t.get("number"),
                "issuer_name": t.get("issuerName"),
                "association": t.get("association"),
                "scope": scope,
                "progress": t.get("progress"),
                "max_participants": player_count,
                "active_participants": active,
                "free_slots": remaining,
                "guests_allowed": guests_allowed,
                "hcp_relevant": hcp_relevant,
                "registration_deadline": t.get("registrationDeadline"),
                "registration_start": t.get("registrationStart"),
                "round_types": round_types,
                "hcp_from": t.get("hcpFrom"),
                "hcp_until": t.get("hcpUntil"),
            },
        )

    def _parse_date(self, date_str: str) -> date | None:
        """Parse dates like '04. April 2026' or '2026-04-04'."""
        if not date_str:
            return None

        # Try ISO format first
        iso_match = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
        if iso_match:
            y, m, d = iso_match.groups()
            return date(int(y), int(m), int(d))

        # German month names
        months = {
            "januar": 1, "februar": 2, "märz": 3, "april": 4,
            "mai": 5, "juni": 6, "juli": 7, "august": 8,
            "september": 9, "oktober": 10, "november": 11, "dezember": 12,
        }
        match = re.match(r"(\d{1,2})\.\s*(\w+)\s+(\d{4})", date_str)
        if match:
            day = int(match.group(1))
            month_name = match.group(2).lower()
            year = int(match.group(3))
            month = months.get(month_name)
            if month:
                return date(year, month, day)

        # DD.MM.YYYY
        dd_match = re.match(r"(\d{1,2})\.(\d{2})\.(\d{4})", date_str)
        if dd_match:
            d, m, y = dd_match.groups()
            return date(int(y), int(m), int(d))

        return None

    def _parse_hcp(self, value: str | None) -> float | None:
        """Parse HCP values like '54,0' or '-10,0'."""
        if not value:
            return None
        try:
            return float(value.replace(",", "."))
        except (ValueError, AttributeError):
            return None
