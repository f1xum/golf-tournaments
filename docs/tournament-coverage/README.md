# Tournament coverage

How to take a region from "most club pages are empty" to "most club pages have
tournaments", and the mistakes already paid for.

Bavaria was done first, in August 2026. Everything here was learned there —
read it before starting another region, because roughly half the effort went
into discovering things that are now written down.

- [platforms.md](platforms.md) — which tournament systems German clubs use,
  which are readable, and which are not
- [pdf-calendars.md](pdf-calendars.md) — reading tournaments out of club PDFs,
  and the four date bugs that shipped before it worked
- [duplicate-clubs.md](duplicate-clubs.md) — why one club appears up to eight
  times, and how merging works
- [regions/bayern.md](regions/bayern.md) — Bavaria's numbers and what is still
  open there

## The one thing to understand first

"This club has no tournaments" almost never means the scraper failed. Measured
across the whole database, clubs with a `pccaddie_id` have upcoming tournaments
74% of the time; clubs without one, 1%. Coverage is a **linkage** problem, not
a scraping problem.

There are only four reasons a club page is empty:

1. It is a duplicate row, and the tournaments are on its twin.
2. Nobody has worked out which tournament platform it uses.
3. It uses a platform with no readable public feed (Albatros).
4. It genuinely publishes nothing online except a PDF — or nothing at all.

They need completely different fixes, and mixing them up wastes days. Find out
which is which *before* writing any scraper code.

## Running a new region

Do these in order. Each step shrinks the work for the next one.

### 1. Merge duplicates first

```bash
python scripts/merge_duplicate_clubs.py --region <Region>          # dry run
python scripts/merge_duplicate_clubs.py --region <Region> --apply
```

Always dry-run first and read the output. In Bavaria this removed 120 of 300
"clubs" — a third of the apparent problem was never distinct clubs at all.
Doing this first means every later step scans a smaller, real list.

See [duplicate-clubs.md](duplicate-clubs.md) for how the matching is
corroborated and why that matters.

### 2. Recover what the database already knows

```bash
python scripts/discover_pccaddie_ids.py --region <Region> --apply
```

No network. Some clubs already store a platform URL in `website` or `bgv_url`,
because the source directory linked their tournament calendar instead of their
homepage. Bavaria got 36 PC CADDIE ids free this way.

### 3. Scan club websites

```bash
python scripts/discover_pccaddie_ids.py --region <Region> --fetch --apply
```

Slow — roughly a minute per club. Records `tournament_platform`, plus
`pccaddie_id` / `albatros_id` / `calendar_pdf_url`. Writes incrementally, so a
crash does not lose the run.

Expect a **low PC CADDIE hit rate**. In Bavaria it was 14 of 190 (7%). That is
not a bug; it means the remaining clubs are on something else.

### 4. Harvest PDF calendars

```bash
python scripts/run_club_pdf_calendars.py
```

Read [pdf-calendars.md](pdf-calendars.md) first. Verify a sample of the output
against the source PDFs before trusting it — every single date bug in this
pipeline looked completely fine in the logs.

### 5. Report what is left, by reason

Group the still-empty clubs by `tournament_platform`. That distinguishes work
that is queued from work that is impossible, and it is the honest answer to
"why is this club still empty".

## Measuring honestly

Two traps when reporting progress:

**Merging makes the ratio jump without adding anything.** It removes empty
duplicate rows, so "clubs with tournaments" improves as a percentage while the
tournament count goes *down*. Report the count and the ratio together.

**The daily scrape is not your work.** Bavaria's first overnight run appeared
to add 249 upcoming tournaments; all of it was the scheduled 07:00 PC CADDIE
run. Check `tournaments.created_at` and `source` before claiming a gain.

Newly written `pccaddie_id`s produce nothing until the next scheduled scrape.
