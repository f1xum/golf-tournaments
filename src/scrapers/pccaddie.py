"""Scrape tournaments from PC CADDIE online tournament calendars.

PC CADDIE is the most common tournament management system for German golf clubs.
URL pattern: https://www.pccaddie.net/clubs/{club_id}/app.php?cat=ts_calendar
Detail page: ...&sub=detail&id={tournament_id}

This gives us structured data: dates, format, fees, handicap limits, slots, etc.
"""

import re
import time

from bs4 import BeautifulSoup

from src.config import settings
from src.models.tournament import Tournament, TournamentSource
from src.scrapers.base import BaseScraper


# Known PC CADDIE club IDs for Bavarian clubs
PCCADDIE_CLUBS: dict[str, str] = {
    "Golfclub München Eichenried": "0498820",
    "Golfclub Erding-Grünbach e.V.": "0498821",
    "Golf Club Erlangen e.V.": "0498822",
    "Golf-Club Feldafing e.V.": "0498824",
    "Golfclub Garmisch-Partenkirchen e.V.": "0498827",
    "Golf-Club Schloss Elkofen e.V.": "0498831",
    "Golf Club Schloß Klingenburg e.V.": "0498832",
    "Golfclub Hof e.V.": "0498834",
    "Golfclub Schloß Igling e.V.": "0498835",
    "Golfclub Lichtenau-Weickershof e.V.": "0498838",
    "Golf-Club Lindau-Bad Schachen e.V.": "0498839",
    "Golfclub Schloss Mainsondheim e.V.": "0498840",
    "Golfclub München-Riedhof e.V.": "0498844",
    "Golfclub Lauterhofen e.V.": "0498845",
    "Golfclub am Reichswald e.V.": "0498847",
    "Golfclub München-West Odelzhausen e.V.": "0498850",
    "Allgäuer Golf- und Landclub e.V.": "0498852",
    "Golf Club Hohenpähl e.V.": "0498853",
    "Golfclub Schloß Reichertshausen e.V.": "0498856",
    "Golf-Club Höslwang im Chiemgau e.V.": "0498859",
    "Golf- und Landclub Schmidmühlen e.V.": "0498864",
    "Golf Resort Sonnenalp - Oberallgäu GmbH": "0498865",
    "Golfclub Starnberg e.V.": "0498866",
    "Golfclub Stiftland e.V.": "0498871",
    "Golfclub Wörthsee e.V.": "0498873",
    "Golf Club Kitzingen e.V.": "0498874",
    "Golf Valley GmbH": "0498875",
    "Golfplatz Iffeldorf GmbH & Co. KG": "0498877",
    "Golfclub Leitershofen e.V.": "0498880",
    "Golf Club Ebersberg e.V.": "0498883",
    "Golfclub Main-Spessart e.V.": "0498885",
    "Golfpark München Aschheim": "0498889",
    "Golfclub Schwanhof": "0498892",
    "Golfclub Fahrenbach im Fichtelgebirge e.V.": "0498897",
    "Golf Club Würzburg e.V.": "0498898",
    "1. Golf Club Fürth e.V.": "0498899",
    "Golfclub Bad Abbach-Deutenhof e.V.": "0498908",
    "Golfclub Gäuboden e.V.": "0498914",
    "Golf-Club Maria Bildhausen e.V.": "0498915",
    "Golf Club Schweinfurt e.V.": "0498920",
    "Golfclub Pleiskirchen e.V.": "0498923",
    "Golfclub Vilsbiburg e.V.": "0498925",
    "Golfclub Miltenberg-Erftal e.V.": "0498926",
    "Golfclub Gerhelm Nürnberger Land e.V.": "0498939",
    "Golfanlage auf der Gsteig": "0498944",
    "New Golf Club Neu-Ulm": "0498946",
    "Golfclub Hassberge e.V.": "0498952",
    "Golfclub München-Riem e.V.": "0498953",
    "Der Golf Club am Obinger See": "0498954",
    "Golfclub am Nationalpark Bayerischer Wald": "0498969",
    "Zieglers Golfplatz GmbH & Co. KG": "0498981",
    "Golfplatz Leonhardshaun": "0498991",
}

PCCADDIE_BASE = "https://www.pccaddie.net/clubs"


class PCCaddieScraper(BaseScraper):
    source_name = "pccaddie"

    def __init__(self, club_ids: dict[str, str] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.club_ids = club_ids or PCCADDIE_CLUBS

    def run(self) -> None:
        all_clubs_db = {c["name"]: c for c in self.db.get_all_clubs()}
        total_found = 0
        total_created = 0

        for club_name, pcc_id in self.club_ids.items():
            calendar_url = f"{PCCADDIE_BASE}/{pcc_id}/app.php?cat=ts_calendar"
            print(f"\n[PC CADDIE] Scraping {club_name} ({pcc_id}): {calendar_url}")

            try:
                html = self.fetch(calendar_url)
            except Exception as e:
                print(f"  ✗ Failed to fetch calendar: {e}")
                if hasattr(self, "_ctx"):
                    self._ctx.errors.append(f"{club_name}: {e}")
                continue

            tournament_ids = self._extract_tournament_ids(html)
            print(f"  Found {len(tournament_ids)} tournaments, fetching details...")
            total_found += len(tournament_ids)

            # Match club in DB
            club = self._find_club(club_name, all_clubs_db)
            club_id = club["id"] if club else None

            rows = []
            for t_id in tournament_ids:
                detail_url = (
                    f"{PCCADDIE_BASE}/{pcc_id}/app.php"
                    f"?cat=ts_calendar&sub=detail&id={t_id}"
                )
                try:
                    detail_html = self.fetch(detail_url)
                    tournament = self._parse_detail_page(detail_html, detail_url, t_id)
                    if tournament:
                        row = tournament.to_db_row()
                        if club_id:
                            row["club_id"] = club_id
                        rows.append(row)
                        print(f"    ✓ {tournament.name} ({tournament.date_start})")
                except Exception as e:
                    print(f"    ✗ Tournament {t_id}: {e}")
                    if hasattr(self, "_ctx"):
                        self._ctx.errors.append(f"{club_name}/{t_id}: {e}")

            # Deduplicate by (name, date_start, club_id, source) before upserting
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

        print(f"\n[PC CADDIE] Done. {total_found} found, {total_created} upserted.")

    def _extract_tournament_ids(self, html: str) -> list[str]:
        """Extract tournament IDs from the calendar listing page."""
        soup = BeautifulSoup(html, "html.parser")
        ids = []

        # Tournament rows have data-id attributes
        for el in soup.find_all(attrs={"data-id": True}):
            t_id = el["data-id"]
            if t_id and t_id not in ids:
                ids.append(t_id)

        # Fallback: look for detail links
        if not ids:
            for link in soup.find_all("a", href=re.compile(r"sub=detail&id=(\d+)")):
                match = re.search(r"id=(\d+)", link["href"])
                if match and match.group(1) not in ids:
                    ids.append(match.group(1))

        return ids

    def _parse_detail_page(
        self, html: str, source_url: str, tournament_id: str
    ) -> Tournament | None:
        """Parse a PC CADDIE tournament detail page.

        The page text follows a key|value pattern like:
        Turnier|HCP Rallye|Datum|Sa., 28.03.2026, 09:00 Uhr|Spielform|Einzel - Stableford|...
        """
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(separator="|", strip=True)

        # Build a key-value dict from the pipe-separated text
        fields = self._extract_pccaddie_fields(text)

        # Tournament name
        name = fields.get("Turnier")
        if not name:
            return None

        # Date
        date_text = fields.get("Datum", "")
        date_match = re.search(r"(\d{1,2})\.(\d{2})\.(\d{4})", date_text)
        if not date_match:
            return None

        from datetime import date as date_type
        d, m, y = date_match.groups()
        date_start = date_type(int(y), int(m), int(d))

        # Format from Spielform: "Einzel - Stableford"
        spielform = fields.get("Spielform", "")
        format_str = None
        if spielform:
            # Extract the scoring method after the dash
            fmt_match = re.search(r"[-–]\s*(.+)", spielform)
            format_str = fmt_match.group(1).strip() if fmt_match else spielform

        # Holes from Turnierart: "Einzel Zählspiel nach Stableford über 18 Löcher"
        turnierart = fields.get("Turnierart", "")
        holes = None
        holes_match = re.search(r"(\d+)\s*Lö", turnierart)
        if holes_match:
            holes = int(holes_match.group(1))

        # Entry fee from Nenngeld: "Mitglieder / jugendliche Mitglieder: 18 €/15€"
        entry_fee = None
        nenngeld = fields.get("Nenngeld", "")
        if nenngeld:
            fee_match = re.search(r"(\d+(?:[.,]\d+)?)\s*€", nenngeld)
            if fee_match:
                entry_fee = float(fee_match.group(1).replace(",", "."))

        # Max participants
        max_participants = None
        teilnehmer = fields.get("Teilnehmer maximal", "")
        if teilnehmer:
            num_match = re.search(r"(\d+)", teilnehmer)
            if num_match:
                max_participants = int(num_match.group(1))

        # Free slots
        free_slots = None
        freie = fields.get("Freie Plätze online", "")
        if freie:
            num_match = re.search(r"(\d+)", freie)
            if num_match:
                free_slots = int(num_match.group(1))

        # Handicap relevant
        hcp_relevant = "Handicap-relevant" in text

        # Registration deadline
        meldeschluss = fields.get("Anmeldung bis", fields.get("Meldeschluss", ""))

        # Prizes from Preise field: "Netto / 3 / Longest Drive Herren / - / ..."
        prizes_raw = fields.get("Preise", "")
        prizes = self._parse_prizes(prizes_raw) if prizes_raw else []

        return Tournament(
            name=name,
            date_start=date_start,
            format=format_str,
            rounds=1,
            entry_fee=entry_fee,
            description=f"{holes} holes" if holes else None,
            source=TournamentSource.CLUB_WEBSITE,
            source_url=source_url,
            raw_data={
                "pccaddie_id": tournament_id,
                "spielform": spielform,
                "turnierart": turnierart,
                "max_participants": max_participants,
                "free_slots": free_slots,
                "hcp_relevant": hcp_relevant,
                "meldeschluss": meldeschluss,
                "nenngeld_raw": nenngeld,
                "prizes": prizes,
                "prizes_raw": prizes_raw,
            },
        )

    def _parse_prizes(self, raw: str) -> list[dict]:
        """Parse prizes text into structured list.

        Input like: "Brutto / 1 / Netto / 3 / Longest Drive Herren / - / Nearest to the pin Damen / -"
        """
        prizes = []
        parts = [p.strip() for p in raw.split("/") if p.strip()]

        i = 0
        while i < len(parts):
            part = parts[i]
            # Check if next part is a number (count of prizes in that category)
            if i + 1 < len(parts) and re.match(r"^\d+$", parts[i + 1]):
                prizes.append({"category": part, "count": int(parts[i + 1])})
                i += 2
            elif part == "-":
                # "-" means it's a special prize with no count
                i += 1
            elif part in ("Brutto", "Netto"):
                # Category header without count yet
                if i + 1 < len(parts) and re.match(r"^\d+$", parts[i + 1]):
                    prizes.append({"category": part, "count": int(parts[i + 1])})
                    i += 2
                else:
                    i += 1
            else:
                # Special prize like "Longest Drive Herren"
                prizes.append({"category": part, "count": 1})
                i += 1

        return prizes

    def _extract_pccaddie_fields(self, text: str) -> dict[str, str]:
        """Extract key-value pairs from PC CADDIE pipe-separated text.

        Known keys in the detail page: Turnier, Datum, Spielform, Ort,
        Anmeldung ab, Anmeldung bis, Teilnehmer maximal, Freie Plätze online,
        Nenngeld, Turnierart, Meldeschluss, etc.
        """
        known_keys = [
            "Turnier", "Datum", "Spielform", "Ort", "Anmeldung ab",
            "Anmeldung bis", "Abmeldung bis", "Information",
            "Teilnehmer maximal", "Freie Plätze online", "Start",
            "Termin", "Abschläge", "Turnierart", "Preise", "Nenngeld",
            "Min. Max Teilnehmer", "Meldeschluss", "Ausschreibungen",
            "Handicap-relevant", "Kalender Datei", "Im Kalender speichern",
            "Zurück", "Jetzt anmelden", "Neue Funktion:",
            "Schliessen", "Impressum", "Datenschutz",
        ]
        fields: dict[str, str] = {}
        parts = [p.strip() for p in text.split("|") if p.strip()]

        i = 0
        while i < len(parts):
            if parts[i] in known_keys:
                key = parts[i]
                # Collect all values until the next known key
                values = []
                i += 1
                while i < len(parts) and parts[i] not in known_keys:
                    values.append(parts[i])
                    i += 1
                fields[key] = " / ".join(values) if values else ""
            else:
                i += 1

        return fields

    def _find_club(self, club_name: str, club_by_name: dict) -> dict | None:
        if club_name in club_by_name:
            return club_by_name[club_name]
        name_lower = club_name.lower()
        for name, club in club_by_name.items():
            if name_lower in name.lower() or name.lower() in name_lower:
                return club
        return self.db.find_club_by_name(club_name)
