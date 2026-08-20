"""Tests for parsing dated rows out of club calendar PDFs.

Every row string here was taken from a real Bavarian club's PDF. The first
version of this parser handled only one club's layout and matched nothing at 31
of 34 clubs, so the four formats found in the survey are each pinned.
"""

from datetime import date

from src.parsers.pdf_calendar import (
    detect_month,
    detect_year,
    extract_dated_rows,
    format_entries,
    parse_row,
)


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


class TestParseRow:
    def test_full_date_wins_and_ignores_the_default_year(self):
        # Golfclub Dachau
        got = parse_row("SO 15.03.2026 09:30 Clean up Event", 1999, None)
        assert got[0] == date(2026, 3, 15)
        assert "Clean up Event" in got[1]

    def test_day_and_month_take_the_document_year(self):
        # Golf-Club Neumarkt
        got = parse_row("Do 01.05. Gastro Scramble", 2026, None)
        assert got[0] == date(2026, 5, 1)
        assert "Gastro Scramble" in got[1]

    def test_day_and_month_name(self):
        # Golfplatz Scheidegg
        got = parse_row("16. Mai 17:00 Uhr 1. Herrengolf", 2026, None)
        assert got[0] == date(2026, 5, 16)

    def test_month_grid_uses_the_page_month(self):
        # Münchener Golf Club
        got = parse_row("18 Sa US Kids Golf Tournament 10.00", 2026, 4)
        assert got == (date(2026, 4, 18), "US Kids Golf Tournament 10.00")

    def test_month_grid_without_a_page_month_is_unusable(self):
        assert parse_row("18 Sa US Kids Golf Tournament", 2026, None) is None

    def test_row_with_a_date_but_no_text_is_dropped(self):
        assert parse_row("12 So", 2026, 8) is None
        assert parse_row("01.05.", 2026, None) is None

    def test_impossible_date_is_rejected(self):
        # A misread column, not a tournament.
        assert parse_row("31.06. Geisterturnier", 2026, None) is None

    def test_course_code_fragment_with_a_date_is_rejected(self):
        # Left over from splitting the Bad Griesbach resort's multi-column PDF.
        # (Semantic junk like "Stand:" or "Karfreitag" is dropped later by the
        # LLM, not here — this gate only rejects unpronounceable fragments.)
        assert parse_row("01.02. Be/Po/Bw", 2026, None) is None
        assert parse_row("01.02. Be/Po/Bw/Ut", 2026, None) is None

    def test_row_without_any_date(self):
        assert parse_row("TURNIERKALENDER 2026", 2026, None) is None


class TestMonthColumnsGrid:
    def test_full_year_grid_reads_month_from_column_not_row(self):
        # Königsbrunn / Waldegg: months are columns across the page. The naive
        # row parser dumped every column into the first month.
        words = [
            # header row
            {"text": "April", "top": 0.0, "x0": 100.0, "x1": 130.0},
            {"text": "Mai",   "top": 0.0, "x0": 300.0, "x1": 320.0},
            {"text": "Juni",  "top": 0.0, "x0": 500.0, "x1": 525.0},
            # day-2 row: one cell per month
            {"text": "2",  "top": 12.0, "x0": 100.0, "x1": 106.0},
            {"text": "Sa", "top": 12.0, "x0": 108.0, "x1": 120.0},
            {"text": "Osterturnier", "top": 12.0, "x0": 122.0, "x1": 180.0},
            {"text": "2",  "top": 12.0, "x0": 300.0, "x1": 306.0},
            {"text": "Mo", "top": 12.0, "x0": 308.0, "x1": 320.0},
            {"text": "Maipokal", "top": 12.0, "x0": 322.0, "x1": 370.0},
        ]
        got = extract_dated_rows(words, "April Mai Juni Juli", 2026)
        assert (date(2026, 4, 2), "Osterturnier") in got
        assert (date(2026, 5, 2), "Maipokal") in got

    def test_a_page_with_only_one_month_name_is_not_treated_as_columns(self):
        words = [
            {"text": "April", "top": 0.0, "x0": 100.0, "x1": 130.0},
            {"text": "15", "top": 12.0, "x0": 0.0, "x1": 10.0},
            {"text": "Mi", "top": 12.0, "x0": 12.0, "x1": 24.0},
            {"text": "BGV", "top": 12.0, "x0": 200.0, "x1": 230.0},
            {"text": "Cup", "top": 12.0, "x0": 232.0, "x1": 260.0},
        ]
        # Falls through to the single-month grid, resolved by the header.
        got = extract_dated_rows(words, "TURNIERE IM MONAT April", 2026)
        assert got == [(date(2026, 4, 15), "BGV Cup")]


class TestDetectYear:
    def test_picks_the_year_the_document_repeats(self):
        assert detect_year("Turnierkalender 2026\n01.05.2026\n02.06.2026\nseit 1985") == 2026

    def test_none_when_no_year(self):
        assert detect_year("Turnierkalender") is None


class TestDetectMonth:
    def test_reads_a_month_from_the_first_line(self):
        assert detect_month("TURNIERE IM MONAT August\nirrelevant") == 8

    def test_finds_a_monat_label_below_the_first_line(self):
        # Münchener Golf Club prints a page number on line one.
        assert detect_month("9\nMünchener Golf Club e.V. TURNIEREIM MONAT April") == 4

    def test_ignores_a_month_named_further_down_the_page(self):
        # "Mai" inside a tournament name must not turn this into a May page.
        assert detect_month("TURNIERKALENDER 2026\n\n\n\n5 Mi Mai-Pokal") is None


class TestExtractDatedRows:
    def test_mixed_page_keeps_only_dated_rows(self):
        words = _words([
            "TURNIERKALENDER 2026",
            "Do 01.05. Gastro Scramble",
            "Mi 03.06. Race to Bad Griesbach",
            "Impressum",
        ])
        got = extract_dated_rows(words, "TURNIERKALENDER 2026", 2026)
        assert [d for d, _ in got] == [date(2026, 5, 1), date(2026, 6, 3)]

    def test_side_by_side_months_are_split_into_columns(self):
        # Several calendars print months next to each other. Read as one row,
        # the first date found would be applied to all of them.
        words = [
            {"text": "Do", "top": 12.0, "x0": 0.0, "x1": 10.0},
            {"text": "01.05.", "top": 12.0, "x0": 12.0, "x1": 40.0},
            {"text": "Gastro", "top": 12.0, "x0": 42.0, "x1": 70.0},
            # big horizontal gap: next month's column
            {"text": "Mi", "top": 12.0, "x0": 200.0, "x1": 210.0},
            {"text": "03.06.", "top": 12.0, "x0": 212.0, "x1": 240.0},
            {"text": "Herrengolf", "top": 12.0, "x0": 242.0, "x1": 300.0},
        ]
        got = extract_dated_rows(words, "Turnierkalender 2026", 2026)
        assert [d for d, _ in got] == [date(2026, 5, 1), date(2026, 6, 3)]
        assert got[0][1] == "Do Gastro"
        assert got[1][1] == "Mi Herrengolf"

    def test_grid_day_cell_claims_its_far_away_entry_column(self):
        # A month grid puts "18 Sa" in a narrow column and the tournament far
        # to the right. Splitting on the gap would orphan the date.
        words = [
            {"text": "18", "top": 12.0, "x0": 0.0, "x1": 10.0},
            {"text": "Sa", "top": 12.0, "x0": 12.0, "x1": 24.0},
            {"text": "US", "top": 12.0, "x0": 200.0, "x1": 214.0},
            {"text": "Kids", "top": 12.0, "x0": 216.0, "x1": 240.0},
            {"text": "Golf", "top": 12.0, "x0": 242.0, "x1": 266.0},
        ]
        got = extract_dated_rows(words, "TURNIERE IM MONAT April", 2026)
        assert got == [(date(2026, 4, 18), "US Kids Golf")]

    def test_grid_page_resolves_against_its_header(self):
        words = _words(["TURNIERE IM MONAT April", "15 Mi BGV Mini Team Cup", "16 Do"])
        got = extract_dated_rows(words, "TURNIERE IM MONAT April", 2026)
        assert got == [(date(2026, 4, 15), "BGV Mini Team Cup")]


class TestFormatEntries:
    def test_renders_iso_dates(self):
        assert format_entries([(date(2026, 5, 1), "Gastro Scramble")]) == (
            "2026-05-01: Gastro Scramble"
        )
