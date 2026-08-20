"""Tests for the club PDF calendar scraper.

Row and date parsing is covered in tests/test_pdf_calendar.py. What matters
here is what the scraper does around it: refusing a stale calendar, and never
trusting a date the model hands back.
"""

from datetime import date
from unittest.mock import patch

import pytest

from src.scrapers.club_pdf_calendar import ClubPDFCalendarScraper, StaleCalendar

CLUB_ID = "e60dee34-6e8b-4a35-ae9c-4073daf719ad"
CLUB = {"id": CLUB_ID, "name": "Münchener Golf Club", "calendar_pdf_url": "https://x/cal.pdf"}


def _words(lines: list[str]) -> list[dict]:
    """Fake positioned words: one PDF row per line, words a few points apart.

    x1 matters — column splitting keys off the gap between one word's right
    edge and the next word's left edge.
    """
    out = []
    for row, line in enumerate(lines):
        x = 0.0
        for token in line.split():
            width = len(token) * 5.0
            out.append({"text": token, "top": row * 12.0, "x0": x, "x1": x + width})
            x += width + 4.0
    return out


def _scraper(year: int = 2026) -> ClubPDFCalendarScraper:
    with patch("src.scrapers.club_pdf_calendar.BaseScraper.__init__", return_value=None):
        s = ClubPDFCalendarScraper.__new__(ClubPDFCalendarScraper)
        s.year = year
        s.club_ids = None
        return s


def _run(extracted, lines=None, year=2026, page_text="Turnierkalender 2026"):
    lines = lines if lines is not None else ["Do 01.05. Gastro Scramble"]
    pages = [(page_text, _words(lines))]
    s = _scraper(year)
    with patch.object(ClubPDFCalendarScraper, "fetch_bytes", return_value=b"%PDF"), \
         patch.object(ClubPDFCalendarScraper, "pages_of", return_value=pages), \
         patch("src.scrapers.club_pdf_calendar.extract_month_page_with_llm",
               return_value=extracted):
        return s.tournaments_for(CLUB)


class TestStaleCalendar:
    def test_last_seasons_pdf_is_refused(self):
        # Several clubs still link an old calendar from a current-looking page.
        # Importing one would invent a season's worth of tournaments.
        with pytest.raises(StaleCalendar):
            _run([{"name": "X", "date_start": "2024-05-01"}],
                 lines=["Do 01.05. Altes Turnier"],
                 page_text="Turnierkalender 2024")

    def test_a_pdf_with_no_year_at_all_is_refused(self):
        with pytest.raises(StaleCalendar):
            _run([], page_text="Turnierkalender")


class TestTournamentsFor:
    def test_builds_a_tournament(self):
        out = _run([{"name": "Gastro Scramble", "date_start": "2026-05-01",
                     "format": "scramble"}])
        assert len(out) == 1
        assert out[0].date_start == date(2026, 5, 1)
        assert str(out[0].club_id) == CLUB_ID

    def test_drops_rows_without_a_usable_date(self):
        # date_start is NOT NULL in the database.
        out = _run([{"name": "Ohne Datum", "date_start": None},
                    {"name": "Kaputt", "date_start": "nonsense"}])
        assert out == []

    def test_rejects_a_model_date_from_another_year(self):
        out = _run([{"name": "Falsches Jahr", "date_start": "2027-05-01"}])
        assert out == []

    def test_collapses_a_tournament_repeated_on_several_rows(self):
        out = _run([{"name": "Clubmeisterschaft", "date_start": "2026-05-01"},
                    {"name": "Clubmeisterschaft", "date_start": "2026-05-01"}])
        assert len(out) == 1

    def test_page_with_no_dated_rows_yields_nothing(self):
        out = _run([{"name": "X", "date_start": "2026-05-01"}],
                   lines=["Impressum und Kontakt"])
        assert out == []
