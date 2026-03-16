"""Extract tournament data from DGV PDF calendars using pdfplumber."""

import re
from datetime import date
from pathlib import Path

import pdfplumber


def extract_tournaments_from_pdf(pdf_path: str | Path) -> list[dict]:
    """Extract raw tournament rows from a DGV PDF calendar.

    Returns a list of dicts with keys: name, date_start, date_end, venue, format, etc.
    """
    tournaments = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Try table extraction first
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    tournaments.extend(_parse_table_rows(table))
            else:
                # Fallback: parse raw text
                text = page.extract_text()
                if text:
                    tournaments.extend(_parse_text_block(text))

    return tournaments


def _parse_table_rows(table: list[list[str | None]]) -> list[dict]:
    """Parse a PDF table into tournament dicts."""
    tournaments = []
    headers = table[0] if table else []

    for row in table[1:]:
        if not row or all(cell is None or cell.strip() == "" for cell in row):
            continue

        tournament = _row_to_dict(row, headers)
        if tournament and tournament.get("name"):
            tournaments.append(tournament)

    return tournaments


def _row_to_dict(row: list[str | None], headers: list[str | None]) -> dict | None:
    """Map a table row to a tournament dict using header names."""
    data: dict = {}

    # Common German header mappings
    header_map = {
        "datum": "date_raw",
        "termin": "date_raw",
        "turnier": "name",
        "bezeichnung": "name",
        "name": "name",
        "ort": "venue",
        "austragungsort": "venue",
        "club": "venue",
        "wertung": "format",
        "spielform": "format",
        "runden": "rounds",
    }

    for i, cell in enumerate(row):
        if i < len(headers) and headers[i]:
            key = headers[i].strip().lower()
            mapped = header_map.get(key, key)
            data[mapped] = cell.strip() if cell else None

    # Parse dates if present
    if data.get("date_raw"):
        date_start, date_end = _parse_date_range(data["date_raw"])
        data["date_start"] = date_start
        data["date_end"] = date_end
        del data["date_raw"]

    return data if data.get("name") else None


def _parse_text_block(text: str) -> list[dict]:
    """Parse freeform text for tournament data (fallback for non-table PDFs)."""
    tournaments = []

    # Split by date patterns
    entries = re.split(r"(?=\d{1,2}\.\d{1,2}\.\d{4})", text)

    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue

        date_match = re.search(
            r"(\d{1,2}\.\d{1,2}\.\d{4})(?:\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4}))?",
            entry,
        )
        if not date_match:
            continue

        date_start, date_end = _parse_date_range(date_match.group(0))

        # The rest of the text after the date is likely the name + venue
        remaining = entry[date_match.end():].strip()
        lines = [l.strip() for l in remaining.split("\n") if l.strip()]

        name = lines[0] if lines else None
        venue = lines[1] if len(lines) > 1 else None

        if name:
            tournaments.append({
                "name": name,
                "date_start": date_start,
                "date_end": date_end,
                "venue": venue,
            })

    return tournaments


def _parse_date_range(text: str) -> tuple[date | None, date | None]:
    """Parse German date range: '17.04.2026 - 19.04.2026' or '02.05.2026'."""
    range_match = re.search(
        r"(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})",
        text,
    )
    if range_match:
        d1, m1, y1, d2, m2, y2 = range_match.groups()
        return date(int(y1), int(m1), int(d1)), date(int(y2), int(m2), int(d2))

    single_match = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", text)
    if single_match:
        d, m, y = single_match.groups()
        dt = date(int(y), int(m), int(d))
        return dt, dt

    return None, None
