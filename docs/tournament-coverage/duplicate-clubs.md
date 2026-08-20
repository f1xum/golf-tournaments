# Duplicate clubs

The same physical club exists in `golf_clubs` several times, because each source
spells it differently and each course sometimes gets its own row. Münchner Golf
Eschenried was **eight rows** covering three real courses. Tournaments attach to
whichever row a scraper matched, so the twins render as clubs that never host
anything — the biggest single source of "this club has no tournaments" reports.

`scripts/merge_duplicate_clubs.py` fixes this. It does **not** delete: it sets
`golf_clubs.merged_into` on the losers, pointing at the keeper. Club URLs are
indexed by Google and referenced from `saved_clubs` and `profiles.home_club_id`,
so a delete would 404 real traffic and drop user data. A pointer lets the app
301 the duplicate to the keeper and lets a bad merge be undone by nulling the
column.

## Why matching is corroborated

Every signal, used alone, produces a *false* merge on real data — and a false
merge hides a real club behind a redirect to a different one, which is worse
than leaving a duplicate. So each signal needs a second to agree:

- **shared `pccaddie_id`** — but a club without its own course can book through
  another's calendar (HVB-Club München books on Schloßberg's). Needs a matching
  name token, town, or coordinates.
- **identical coordinates** — but a resort has several distinct courses at one
  point (Bad Griesbach), and the geocoder sometimes only resolves to a town
  centre. Needs a shared name token.
- **same normalised name in different towns** — usually two clubs named after
  the same thing. Needs the same town or site.
- **same website domain** — this is what catches the Eschenried cluster that
  name and coordinate matching miss. Needs a shared name token; on its own it
  would merge all six Quellness courses.

Real merges agree on two signals; false ones agree on only one. See
`tests/test_club_merging.py` for the specific pairs, each taken from live data.

## Keeping the course names

Collapsing eight Eschenried rows would destroy the only record that "Gröbenbach"
and "Gut Häusern" exist — the `courses` column holds PC CADDIE tee-time slots,
not course names, and the identity lives in the row-name suffix. So the merge
records every collapsed name in `golf_clubs.also_known_as`. The club page lists
them ("Auch bekannt als: …") and club search matches them, so a golfer who knows
a course by name still finds the club.

## Keeper selection

The surviving row is the one with the most upcoming tournaments (it is the row
scrapers actually feed, and the one already accumulating inbound links).
Tie-broken by a name that is *not* a course variant — a spaced dash marks a
course ("Münchner Golf Eschenried - Platz Eschenhof"), so the plain club name
wins the page title. Without that tiebreak, an all-zero cluster titled the club
after one of its courses.

## The scraper side

Scrapers must never see merged rows, or they would re-attach a tournament to the
duplicate the merge just emptied. `Database.get_all_clubs()` and the platform
getters filter `merged_into IS NULL`; the web app hides merged rows from every
browse surface and 301s their club page. Only the merge script itself reads
merged rows (to detect an already-merged group).

## Also cleaned here

`scripts/clean_club_text_fields.py` strips scraper artefacts the merge output
surfaced: non-breaking spaces inside names, and whole blocks of page furniture
captured into `city` (`"Velden\nE-Mail schreiben\nwww"`). Cosmetic and safe;
run it once per region after scraping.
