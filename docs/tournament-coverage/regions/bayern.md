# Bayern

First region done, August 2026. Key users are Munich golfers, so it went first.

Region tag is messy: Bavarian clubs are stored as `Bayern`, as a
Regierungsbezirk (`Oberbayern`, `Schwaben`, …), or as `München`. Use the full
set of nine values — see `REGION_GROUPS["Bayern"]` in
`scripts/merge_duplicate_clubs.py` and `discover_pccaddie_ids.py`, and
`RAW_REGION_ALIASES` in `web/lib/regions.ts`. Filtering on `region = 'Bayern'`
alone misses ~80 clubs.

## Where it stands (2026-08-20)

| | start | after this work |
|---|---|---|
| clubs (raw rows) | 300 | 180 canonical (120 merged away) |
| clubs with tournaments | 85 | 79 |
| clubs still empty | 215 | 101 |

The "with tournaments" count barely moved because merging removed 120 phantom
rows; as a share it went 28% → 44%. 12 clubs newly filled from PDF calendars
(550 tournaments, e.g. Münchener Golf Club 100, Gut Ludwigsberg 105).

## What did the work

- **Merge**: 120 duplicate rows collapsed, ~57 club pages reconnected to
  existing tournaments.
- **PC CADDIE ids**: 36 recovered offline + 14 from website scan. These fill in
  on the next scheduled scrape, not immediately.
- **PDF calendars**: 12 clubs, 550 tournaments.

## The 101 still empty, by reason

- **~50 `unknown`** — scanned, no recognised platform and no usable PDF found.
  Some publish only a PDF at a path the scan did not try; worth a manual look.
- **19 Albatros** — no public feed. Their PDFs are the only route, where they
  publish one. ([platforms.md](../platforms.md))
- **7 image-only PDFs** — need OCR.
- **8 stale PDFs / 3 dead URLs** — need a corrected `calendar_pdf_url`.
- remainder: no online tournament source found at all.

## Manual fixes applied (watch for these elsewhere)

- **Münchener Golf Club**'s `website` was a dead PDF link and its calendar lives
  at `/golfsport/`, which the scan does not try. Set `calendar_pdf_url` by hand.
  The scan later overwrote it (bug now fixed — it re-reads before writing); if
  you hand-set a URL, re-check it survived the next scan.

## Still open in Bavaria

- The 6 Bad Griesbach / Quellness resort courses share one PDF and are skipped;
  per-course attribution by the `Be`/`Po`/`Bw`/`Ut`/`Le` codes would recover them.
- ~50 `unknown` clubs deserve a manual pass — the auto-scan's PDF detection only
  tries a fixed list of subpaths.
