"""Pull dated rows out of German club tournament-calendar PDFs.

These PDFs are print layouts and there is no single format. Surveying the 34
Bavarian clubs that publish one found four, in this proportion:

    13  "18.04. Tiger Rabbit"            day and month, year from the title
     6  "1 Mi  Angolfen"                 month grid; month only in the header
     6  "16. Mai 17:00 Uhr Herrengolf"   day and month name
     3  "SO 15.03.2026 09:30 Clean up"   full date on the row

An earlier version of this module handled only the month grid, because it was
written against a single club's PDF (Münchener Golf Club). It matched nothing
at 31 of 34 clubs. Hence the survey, and hence the ordering below: the most
specific date pattern wins, and the grid — which needs the page header to mean
anything — is the last resort.

Rows are assembled from word coordinates rather than page.extract_text(),
which emits whole columns at a time and so destroys the link between a day and
its tournament. Dates come from the PDF's geometry and text, never from a model.
"""

import re
from collections import Counter, defaultdict
from datetime import date

# Rows sit ~12pt apart; half a row groups a line without merging two.
ROW_BAND = 6

MONTH_NAMES = {
    "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4, "mai": 5,
    "juni": 6, "juli": 7, "august": 8, "september": 9, "oktober": 10,
    "november": 11, "dezember": 12,
}
_MONTH_ALT = "|".join(sorted(MONTH_NAMES, key=len, reverse=True))

# Ordered most specific first. Each yields (day, month or None).
FULL_DATE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b")
DAY_MONTH = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(?!\d)")
DAY_MONTHNAME = re.compile(rf"\b(\d{{1,2}})\.?\s*({_MONTH_ALT})\b", re.IGNORECASE)
GRID_DAY = re.compile(r"^(\d{1,2})\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\b\s*(.*)$", re.DOTALL)
# A column holding nothing but "18 Sa" — the day cell of a month grid.
BARE_DAY = re.compile(r"^\d{1,2}\s+(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?$")
MONTH_HEADER = re.compile(rf"\b({_MONTH_ALT})\b", re.IGNORECASE)


# Words further apart than this on the same line belong to different columns.
# Several calendars print three or four months side by side, so a single
# horizontal band can hold one entry per month. Treating the band as one row
# merges them and the first date found wins for all of them — that is how
# "So 12 Strawberry Season Opening" ended up dated 15 January.
COLUMN_GAP = 24


def rows_from_words(words: list[dict]) -> list[str]:
    """Visual rows, each split into its columns, read left to right."""
    bands: dict[int, list[dict]] = defaultdict(list)
    for word in words:
        bands[round(word["top"] / ROW_BAND) * ROW_BAND].append(word)

    rows: list[str] = []
    for band in sorted(bands):
        ordered = sorted(bands[band], key=lambda w: w["x0"])
        segments: list[list[dict]] = [[ordered[0]]]
        for previous, word in zip(ordered, ordered[1:]):
            if word["x0"] - previous.get("x1", previous["x0"]) > COLUMN_GAP:
                segments.append([word])
            else:
                segments[-1].append(word)

        texts = [" ".join(w["text"] for w in segment) for segment in segments]
        # A month grid puts the day in its own narrow column, far from the
        # tournament — splitting there would orphan the date from its entry.
        # A bare day marker therefore claims the rest of its line, whereas
        # side-by-side month columns each carry their own date and stay apart.
        if len(texts) > 1 and BARE_DAY.match(texts[0]):
            rows.append(" ".join(texts))
        else:
            rows.extend(texts)
    return rows


def detect_year(text: str) -> int | None:
    """The year the calendar is for: the one it repeats most often."""
    years = Counter(int(y) for y in re.findall(r"\b(20\d{2})\b", text))
    return years.most_common(1)[0][0] if years else None


MONAT_HEADER = re.compile(rf"MONAT\s*({_MONTH_ALT})", re.IGNORECASE)

# Header lines to consider when there is no explicit "MONAT" label. Kept small
# so a month named inside a tournament further down the page cannot win.
HEADER_LINES = 3


def detect_month(text: str) -> int | None:
    """Month for a page whose rows carry only day numbers.

    An explicit "MONAT April" label wins wherever it appears — Münchener Golf
    Club prints a page number on line one and the label on line two, so
    restricting this to the first line found no month at all and left every
    grid row unresolvable.

    Without such a label, only the top few lines are considered, so that "Mai"
    inside a tournament name cannot turn the page into a May page.
    """
    if not text.strip():
        return None
    match = MONAT_HEADER.search(text)
    if match:
        return MONTH_NAMES[match.group(1).lower()]
    head = "\n".join(text.strip().split("\n")[:HEADER_LINES])
    match = MONTH_HEADER.search(head)
    return MONTH_NAMES[match.group(1).lower()] if match else None


def _clean(text: str) -> str:
    return " ".join(text.split())


def parse_row(row: str, year: int, month_hint: int | None) -> tuple[date, str] | None:
    """(date, remaining text) for a row that carries one, else None."""
    row = row.strip()
    if not row:
        return None

    for pattern, has_year in ((FULL_DATE, True), (DAY_MONTH, False)):
        match = pattern.search(row)
        if match:
            day, month = int(match.group(1)), int(match.group(2))
            row_year = int(match.group(3)) if has_year else year
            rest = _clean(row[: match.start()] + " " + row[match.end():])
            return _build(day, month, row_year, rest)

    match = DAY_MONTHNAME.search(row)
    if match:
        day = int(match.group(1))
        month = MONTH_NAMES[match.group(2).lower()]
        rest = _clean(row[: match.start()] + " " + row[match.end():])
        return _build(day, month, year, rest)

    # Month grid: the day number is on the row, the month only in the header.
    match = GRID_DAY.match(row)
    if match and month_hint:
        return _build(int(match.group(1)), month_hint, year, _clean(match.group(2)))

    return None


def looks_like_a_tournament(text: str) -> bool:
    """Reject row remnants that carry a date but name nothing.

    Splitting a multi-column page leaves fragments — course-code legends
    ("Be/Po/Bw"), footers ("Stand:"), stray times. They parse as dated rows and
    would be filed as real tournaments. A genuine entry always has a word you
    could read aloud, so require some actual prose.
    """
    letters = sum(character.isalpha() for character in text)
    longest = max((len(word) for word in re.findall(r"[A-Za-zÄÖÜäöüß]+", text)), default=0)
    return letters >= 8 and longest >= 4


def _build(day: int, month: int, year: int, rest: str) -> tuple[date, str] | None:
    if not looks_like_a_tournament(rest):
        return None
    try:
        return date(year, month, day), rest
    except ValueError:
        # 31 June and friends: a misread, not a tournament.
        return None


def extract_dated_rows(
    words: list[dict], page_text: str, year: int
) -> list[tuple[date, str]]:
    """Every row on a page that resolves to a date plus some text."""
    month_hint = detect_month(page_text)
    found = []
    for row in rows_from_words(words):
        parsed = parse_row(row, year, month_hint)
        if parsed:
            found.append(parsed)
    return found


def format_entries(entries: list[tuple[date, str]]) -> str:
    """Render resolved rows as dated lines for the LLM.

    The date is already fixed here, so the model only names and classifies and
    cannot reintroduce a date error.
    """
    return "\n".join(f"{when.isoformat()}: {text}" for when, text in entries)
