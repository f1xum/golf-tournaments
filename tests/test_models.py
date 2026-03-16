"""Tests for Pydantic models and their validators."""

from datetime import date

from src.models.club import GolfClub
from src.models.tournament import Tournament, TournamentFormat, TournamentSource
from src.models.scrape_log import ScrapeLog, ScrapeStatus


class TestGolfClub:
    def test_url_normalization(self):
        club = GolfClub(name="Test GC", website="www.test.de")
        assert club.website == "https://www.test.de"

    def test_url_already_has_scheme(self):
        club = GolfClub(name="Test GC", website="https://www.test.de")
        assert club.website == "https://www.test.de"

    def test_postal_code_padding(self):
        club = GolfClub(name="Test GC", postal_code="1234")
        assert club.postal_code == "01234"

    def test_to_db_row_excludes_id(self):
        club = GolfClub(name="Test GC", city="München")
        row = club.to_db_row()
        assert "id" not in row
        assert row["name"] == "Test GC"
        assert row["city"] == "München"


class TestTournament:
    def test_format_normalization_german(self):
        t = Tournament(
            name="Test", date_start=date(2026, 5, 1), source=TournamentSource.BGV, format="Zählspiel"
        )
        assert t.format == TournamentFormat.STROKEPLAY

    def test_format_normalization_english(self):
        t = Tournament(
            name="Test", date_start=date(2026, 5, 1), source=TournamentSource.BGV, format="stableford"
        )
        assert t.format == TournamentFormat.STABLEFORD

    def test_format_unknown(self):
        t = Tournament(
            name="Test", date_start=date(2026, 5, 1), source=TournamentSource.BGV, format="weird_format"
        )
        assert t.format == TournamentFormat.OTHER

    def test_date_end_defaults_to_start(self):
        t = Tournament(
            name="Test", date_start=date(2026, 5, 1), source=TournamentSource.BGV
        )
        assert t.date_end == date(2026, 5, 1)

    def test_fee_parsing_german(self):
        t = Tournament(
            name="Test",
            date_start=date(2026, 5, 1),
            source=TournamentSource.BGV,
            entry_fee="30,50 €",
        )
        assert t.entry_fee == 30.50

    def test_to_db_row(self):
        t = Tournament(
            name="Test",
            date_start=date(2026, 5, 1),
            source=TournamentSource.BGV,
            format="stableford",
        )
        row = t.to_db_row()
        assert row["source"] == "bgv"
        assert row["date_start"] == "2026-05-01"
        assert row["format"] == "stableford"


class TestScrapeLog:
    def test_status_serialization(self):
        log = ScrapeLog(source="test", status=ScrapeStatus.SUCCESS, items_found=10)
        row = log.to_db_row()
        assert row["status"] == "success"
        assert row["items_found"] == 10
