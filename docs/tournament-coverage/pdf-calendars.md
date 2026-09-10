# Reading club PDF calendars

For clubs with no readable feed — chiefly Albatros — the club's own published
PDF Wettspielkalender is the source. `src/scrapers/club_pdf_calendar.py` reads
it; `src/parsers/pdf_calendar.py` does the parsing.

This is the hardest part of the pipeline and shipped **four separate date bugs**
before it worked. Every one of them produced confident, wrong output that looked
fine in the logs. The lessons below are the reason it eventually worked; do not
relearn them.

## The two rules that prevent the bugs

**1. Dates come from the PDF, never from the model.** The parser resolves each
row's date from the PDF's own text and geometry, then hands the LLM an
already-dated line and asks only for the name and format. The LLM cannot change
a date it is given.

**2. The calendar's own year decides whether it is imported at all.** Many clubs
still link a previous season's PDF from a current-looking page. `detect_year`
reads the year the document repeats most; if it is not the target year, the club
is skipped rather than importing last season as this one.

## The mistakes, in the order they were made

**Over-fitting to one PDF.** The parser was first written against Münchener Golf
Club's calendar and matched *nothing* at 31 of 34 other clubs. Always survey the
whole region's PDFs before writing a parser — they share no single format.

**Letting the LLM infer dates from raw text.** `pdfplumber`'s `extract_text()`
emits an entire column before the next one, so on a month grid it prints every
day number first and every tournament afterwards. The model dated the US Kids
Golf Tournament to 13 April; the PDF says 18 April. Off by up to five days, and
totally plausible-looking. Fix: rebuild rows from word coordinates.

**Merging side-by-side month columns.** Several calendars print three or four
months across the page. Grouping a horizontal band into one row merged them and
the first date won for all of them. Fix: split a row into columns on large
horizontal gaps (`COLUMN_GAP`).

**Then breaking the month grid while fixing the columns.** A month grid puts the
day in a narrow left column and the tournament far to the right — exactly the
gap the column-splitter cuts on. That orphaned the date. Fix: a column that is
only a day marker (`BARE_DAY`) reclaims the rest of its line, so grids rejoin
while true multi-column layouts stay split.

**A month header the detector could not see.** `detect_month` was narrowed to
the first line (so a "Mai" inside a tournament name could not hijack a page),
but MGC prints a page number on line one and `MONAT April` on line two. Result:
grid rows parsed but had no month to attach to, and MGC silently produced zero.
Fix: an explicit `MONAT` label wins anywhere in the page; without one, only the
top few lines are searched.

**A whole-year grid with months as columns.** A fifth layout, missed until a
spot-check caught it: Königsbrunn and Waldegg print the entire year on one page,
one column per month, one row per day. The row parser read each row left to
right and filed every column's entry under the first month — Königsbrunn came
out all-January, Waldegg all-April. This passed review because the counts looked
fine (105, 42); only lining the stored dates up against the PDF exposed it. Fix:
when the header names three or more months in a row (`month_column_headers`),
read the page as a grid — month from a word's x-position against the header
columns, day from the cell — instead of row by row. Cells that carry their own
`DD.MM.` (Neumarkt does) are parsed normally first; the column month is only the
fallback.

The through-line, said five times over: **every one of these was invisible in
the run log and only showed up when output was compared against the source
PDF.** The counts always looked healthy. Verifying a sample of actual dates
against the actual PDF is not optional — it is the only thing that caught any of
these.

## Formats seen in Bavaria

Surveyed across 34 club PDFs, then corrected by the spot-check:

| rows on the page look like            | how the date resolves          |
|---------------------------------------|--------------------------------|
| `18.04. Tiger Rabbit`                 | day+month, year from title     |
| `1 Mi  Angolfen` (single-month grid)  | day on row, month in header    |
| `16. Mai 17:00 Herrengolf`            | day + month name               |
| `SO 15.03.2026 Clean up`              | full date on the row           |
| full-year grid, one column per month  | month from column x, day from cell |

The single-page format detection (`month_column_headers` vs `detect_month` vs a
plain dated row) lives in `extract_dated_rows`. Row-level formats are tried
most-specific-first in `parse_row`. Add a new format to whichever applies, with
a test built from a real row string, and re-run the spot-check.

## Known limits (not yet solved)

- **Image-only PDFs.** ~7 Bavarian clubs publish a scanned image with no text
  layer. Nothing extractable without OCR.
- **Shared resort PDFs.** Six Bad Griesbach courses link one Quellness PDF
  covering all of them. Importing per club would file every tournament six
  times, so these are **skipped**. The rows do carry course codes
  (`Be`/`Po`/`Bw`/`Ut`/`Le`), so per-course attribution is possible later.
- **Dead / stale URLs.** Some stored `calendar_pdf_url`s 404 or point at a
  2016–2025 file. Stale ones are refused by the year check; dead ones just error.

## Expected yield

Of 34 Bavarian PDF clubs, ~12–16 import cleanly. The rest are image-only, stale,
dead, or shared. "Every club has tournaments" is **not reachable from PDFs
alone** — plan for a residue that needs OCR, a corrected URL, or has no online
source at all.
