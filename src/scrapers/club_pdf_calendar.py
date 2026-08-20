"""Read tournaments from a club's own published PDF Wettspielkalender.

Why this exists: a large share of German clubs — Münchener Golf Club among them
— do not use PC CADDIE. Many are on Albatros, whose API requires
authentication, so there is no public feed to read. What those clubs *do*
publish is a PDF tournament calendar on their own website, freely downloadable.
That PDF is the legitimate source for them.

There is no single PDF format — src/parsers/pdf_calendar.py handles the four
that occur across the Bavarian clubs, and that module documents them.

Two rules hold whatever the layout:

Dates come from the PDF, never from the model. Rows are rebuilt from word
coordinates and the date is resolved before the LLM sees anything; the model
only names and classifies an already-dated line. An earlier version let it
infer dates from page text and it placed the US Kids Golf Tournament on 13
April when the PDF says 18 April — a tournament on the wrong day is worse than
no tournament at all.

And the calendar's own year decides whether it is imported at all. Several
clubs still link a previous season's PDF from a current-looking page; importing
one would fabricate a season's worth of tournaments.
"""

from collections import Counter
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile

import pdfplumber

from src.models.tournament import Tournament, TournamentSource
from src.parsers.llm_extractor import extract_month_page_with_llm
from src.parsers.pdf_calendar import detect_year, extract_dated_rows, format_entries
from src.scrapers.base import BaseScraper


class StaleCalendar(Exception):
    """The PDF is for a different season than the one being imported."""


class ClubPDFCalendarScraper(BaseScraper):
    """Extract tournaments from `golf_clubs.calendar_pdf_url` for each club."""

    source_name = "club_pdf_calendar"

    def __init__(self, year: int | None = None, club_ids: list[str] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.year = year or date.today().year
        self.club_ids = club_ids

    def clubs_with_pdf(self) -> list[dict]:
        query = (
            self.db.client.table("golf_clubs")
            .select("id,name,calendar_pdf_url")
            .not_.is_("calendar_pdf_url", "null")
            .is_("merged_into", "null")
        )
        if self.club_ids:
            query = query.in_("id", self.club_ids)
        return query.execute().data

    def pages_of(self, pdf_bytes: bytes) -> list[tuple[str, list[dict]]]:
        """(text, positioned words) per page.

        The words are what matter: extract_text() loses the grid alignment
        between a day number and its tournament. The text is used only to find
        the month in the page header.
        """
        tmp = None
        try:
            with NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
                handle.write(pdf_bytes)
                tmp = Path(handle.name)
            with pdfplumber.open(tmp) as pdf:
                return [
                    (page.extract_text() or "", page.extract_words())
                    for page in pdf.pages
                ]
        finally:
            if tmp:
                tmp.unlink(missing_ok=True)

    def tournaments_for(self, club: dict) -> list[Tournament]:
        pdf_bytes = self.fetch_bytes(club["calendar_pdf_url"])
        pages = self.pages_of(pdf_bytes)

        # The year the document is for, taken from the document itself. Five of
        # the 34 Bavarian calendar PDFs are last year's or older, still linked
        # from the club site; importing those would fabricate a season.
        document_text = "\n".join(text for text, _ in pages)
        year = detect_year(document_text)
        if year != self.year:
            raise StaleCalendar(f"calendar is for {year}, expected {self.year}")

        found: list[Tournament] = []
        seen: set[tuple[str, date]] = set()

        for page_number, (text, words) in enumerate(pages, 1):
            entries = extract_dated_rows(words, text, year)
            if not entries:
                continue

            for raw in extract_month_page_with_llm(format_entries(entries)):
                name = (raw.get("name") or "").strip()
                if not name or not raw.get("date_start"):
                    continue
                try:
                    starts = date.fromisoformat(raw["date_start"])
                except (TypeError, ValueError):
                    continue
                if starts.year != year:
                    continue
                # The same tournament can be printed on several rows; the
                # unique index would reject the second copy anyway.
                if (name, starts) in seen:
                    continue
                seen.add((name, starts))

                found.append(Tournament(
                    name=name,
                    club_id=club["id"],
                    date_start=starts,
                    format=raw.get("format"),
                    description=(raw.get("description") or None),
                    source=TournamentSource.CLUB_WEBSITE,
                    source_url=club["calendar_pdf_url"],
                    raw_data={"pdf_page": page_number, "extractor": "pdf_calendar"},
                ))
        return found

    def run(self) -> None:
        clubs = self.clubs_with_pdf()

        # Six Bad Griesbach courses link the same resort-wide Quellness PDF.
        # Importing it per club would file every tournament six times, against
        # six different clubs. The rows do name a course ("Be/Po/Bw/Ut"), so
        # this is splittable later — until then, skipping is the honest option.
        shared = Counter(c["calendar_pdf_url"] for c in clubs)
        skipped = [c for c in clubs if shared[c["calendar_pdf_url"]] > 1]
        clubs = [c for c in clubs if shared[c["calendar_pdf_url"]] == 1]

        print(f"[PDF] {len(clubs)} clubs with their own calendar PDF.")
        if skipped:
            print(f"[PDF] skipping {len(skipped)} clubs sharing a calendar with "
                  f"another club (needs per-course attribution):")
            for club in skipped:
                print(f"      – {club['name']}")
        print()

        for index, club in enumerate(clubs, 1):
            print(f"[{index}/{len(clubs)}] {club['name']}", flush=True)
            try:
                tournaments = self.tournaments_for(club)
            except Exception as error:
                message = f"{club['name']}: {error}"
                print(f"  ✗ {message}")
                if hasattr(self, "_ctx"):
                    self._ctx.errors.append(message)
                continue

            if not tournaments:
                print("  – no tournaments found")
                continue

            rows = [t.to_db_row() for t in tournaments]
            self.db.upsert_tournaments(rows)
            print(f"  ✓ {len(rows)} tournaments")
            if hasattr(self, "_ctx"):
                self._ctx.items_found += len(rows)
