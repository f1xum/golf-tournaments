# Tournament platforms

German clubs do not all use PC CADDIE. Treating PC CADDIE as the only source is
the single biggest reason coverage looks broken. Bavaria's clubs, once
de-duplicated, split across at least four systems.

`golf_clubs.tournament_platform` records which one each club uses:
`pccaddie` | `albatros` | `nexxchange` | `pdf` | `unknown` (scanned, nothing
found) | `NULL` (not scanned yet).

## PC CADDIE — readable, the backbone

`pccaddie.net/clubs/{id}/app.php?cat=ts_calendar`. Public, no auth. The id is a
7-digit zero-padded number stored in `golf_clubs.pccaddie_id`; the scraper is
keyed on it. This is ~35k of the ~37k tournaments in the database. If a club is
on PC CADDIE, getting its id is the whole job.

## Albatros — NOT readable, and the big gap

`https://{slug}.albatros9.net/a9online/#/tournaments`, API base `/a9/rs/cs/`.

**Every endpoint requires authentication — 401 without a token, including the
ICS export, despite the client code calling it `anonymousTournamentView`.**
There is no public feed. Do not try to get around the auth: this is a
third-party commercial system, and the whole strategy depends on staying a
good-faith reader. For Albatros clubs, the club's own PDF is the route (see
[pdf-calendars.md](pdf-calendars.md)).

19 of ~180 Bavarian clubs are on Albatros, including Münchener Golf Club.

**Trap that hid this for months:** the host is `albatros9.net`, not
`albatros.net`. The original detection regex was `/albatros\.net/` and could
never match, so Albatros usage was invisible in the data until someone actually
followed a club's tournament link by hand.

`golf_clubs.albatros_id` stores the tenant slug (`muenchener`, `ingolstadt`, …).

## Nexxchange — readable, small

Detected by a 24-hex `issuerId` in the page. A scraper exists
(`src/scrapers/nexxchange.py`). Only a handful of clubs.

## golf.de / DGV — dead

`serviceportal.dgv-intranet.de/.../turnierkalender-{year}.pdf` returned the
annual calendar. **The URL now 404s**, which is why `dgv_tournaments` logs 0
items on every run. If revived, note the year is in the URL and must be bumped
annually. Not currently a source.

## How detection works

`scripts/discover_pccaddie_ids.py` scans a club's stored URLs (offline) and
then its website (`--fetch`), and sets `tournament_platform` from what it finds.
A club it reaches but cannot classify is marked `unknown` rather than left
`NULL`, so dead ends are not rescanned forever. Force a re-scan with `--rescan`.

Detection precedence, most-preferred feed first: `pccaddie` → `albatros` →
`nexxchange` → `pdf`. A PDF is always the fallback; if a club also runs a
readable platform, use that instead.
