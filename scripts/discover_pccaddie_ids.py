"""Discover tournament-platform IDs (PC CADDIE, Nexxchange) for golf clubs.

Why this matters: the tournament scrapers are keyed on golf_clubs.pccaddie_id.
A club without one is never visited, so its page shows no tournaments no matter
how many it actually runs. Measured on the live database, clubs *with* an id
have upcoming tournaments 74% of the time; clubs without one, 1%. Filling this
column in is the single biggest lever on tournament coverage.

Two passes:

  1. OFFLINE (default, no network) — many clubs already store a PC CADDIE URL
     in golf_clubs.website or .bgv_url, because the source directory linked
     their tournament calendar rather than their homepage. The id is sitting
     right there in a string we already have.

  2. ONLINE (--fetch) — scan the club's own site for an embedded PC CADDIE
     calendar. This hits club websites, so it is opt-in.

Usage:
    python scripts/discover_pccaddie_ids.py                  # offline dry run
    python scripts/discover_pccaddie_ids.py --apply          # offline, write
    python scripts/discover_pccaddie_ids.py --fetch --apply  # + scan websites
"""

import argparse
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import Database

# Mirrors REGION_GROUPS in scripts/merge_duplicate_clubs.py and
# RAW_REGION_ALIASES in web/lib/regions.ts — keep the three in step.
REGION_GROUPS = {
    "Bayern": {
        "bayern", "oberbayern", "niederbayern", "schwaben", "oberpfalz",
        "oberfranken", "mittelfranken", "unterfranken", "münchen", "muenchen",
    },
}

# PC CADDIE club ids are 7 digits and always appear after /clubs/ in a URL.
# Anchoring on the path segment avoids matching unrelated 7-digit numbers.
PCCADDIE_PATTERN = re.compile(r"pccaddie\.(?:net|com)/clubs/(\d{6,8})", re.IGNORECASE)
# Some sites build the iframe src in JS: pcc_club_id = "0498847".
PCCADDIE_JS_PATTERN = re.compile(
    r"""(?:pcc|pccaddie)[_-]?(?:club[_-]?)?id["'\s:=]+["']?(\d{6,8})""", re.IGNORECASE
)
NEXXCHANGE_ISSUER_PATTERN = re.compile(r"issuerId[\"':\s=]+([0-9a-f]{24})", re.IGNORECASE)
# Albatros gives each club a subdomain: muenchener.albatros9.net/a9online/#/tournaments.
# The host is albatros9.net — an earlier /albatros\.net/ pattern could never match,
# which is why Albatros usage went unnoticed.
ALBATROS_PATTERN = re.compile(r"https?://([a-z0-9-]+)\.albatros9\.net", re.IGNORECASE)
# A linked PDF whose name says calendar. Albatros clubs have no readable feed,
# so their own published PDF is the only legitimate source — see
# src/scrapers/club_pdf_calendar.py.
CALENDAR_PDF_PATTERN = re.compile(
    r"""https?://[^"'\s<>]*(?:turnier|wettspiel|spielplan)[^"'\s<>]*\.pdf""", re.IGNORECASE
)

# German clubs file their tournament calendar under a wide range of paths, and
# the PC CADDIE embed usually lives on that page rather than the homepage.
TOURNAMENT_SUBPAGES = [
    "/turniere", "/turnierkalender", "/wettspiele", "/wettspielkalender",
    "/sport/turniere", "/golf/turniere", "/spielbetrieb", "/turnier",
    "/sport", "/turniere/turnierkalender",
]

# Extensions that mean the stored "website" is a document, not a page.
FILE_SUFFIXES = (".pdf", ".jpg", ".jpeg", ".png", ".gif", ".doc", ".docx", ".xls", ".xlsx")


def scan(text: str) -> dict:
    """Extract platform ids from a blob of HTML or a URL string.

    Also sets tournament_platform, so a scanned club that turns out to run no
    recognised system is recorded as "unknown" rather than staying
    indistinguishable from one nobody has looked at yet.
    """
    found = {}
    m = PCCADDIE_PATTERN.search(text) or PCCADDIE_JS_PATTERN.search(text)
    if m:
        # PC CADDIE ids are zero-padded to 7 chars ("0498847"); a JS match may
        # have dropped the leading zero.
        found["pccaddie_id"] = m.group(1).zfill(7)
        found["tournament_platform"] = "pccaddie"
    m = ALBATROS_PATTERN.search(text)
    if m and "albatros_id" not in found:
        found["albatros_id"] = m.group(1).lower()
        found.setdefault("tournament_platform", "albatros")
    m = NEXXCHANGE_ISSUER_PATTERN.search(text)
    if m:
        found["nexxchange_id"] = m.group(1)
        found.setdefault("tournament_platform", "nexxchange")
    m = CALENDAR_PDF_PATTERN.search(text)
    if m:
        found["calendar_pdf_url"] = m.group(0)
        # Lowest priority: a club on a real platform may also publish a PDF,
        # and the live feed is always the better source.
        found.setdefault("tournament_platform", "pdf")
    return found


def homepage_of(url: str) -> str | None:
    """Origin for a stored website URL.

    34 clubs have a PDF as their `website` — the directory we imported from
    linked "Wettspielkalender 2026" instead of the club site. Fetching a PDF
    finds nothing, so fall back to the origin, which is the real club site.
    """
    try:
        p = urlparse(url)
    except ValueError:
        return None
    if not p.scheme.startswith("http") or not p.netloc:
        return None
    return f"{p.scheme}://{p.netloc}"


def offline_pass(clubs: list[dict]) -> dict[str, dict]:
    """Ids recoverable from strings already in the database. No network."""
    updates: dict[str, dict] = {}
    for club in clubs:
        found = {}
        for field in ("website", "bgv_url"):
            if club.get(field):
                found.update(scan(club[field]))
        update = {
            k: v for k, v in found.items()
            if v and not club.get(k)
        }
        if update:
            updates[club["id"]] = update
    return updates


def online_pass(clubs: list[dict], delay: float, on_found=None) -> dict[str, dict]:
    """Scan each club's own website. Hits the network.

    `on_found(club_id, update)` is called for each hit so callers can write
    results incrementally rather than losing a long run to one failure.
    """
    updates: dict[str, dict] = {}
    client = httpx.Client(
        timeout=15,
        follow_redirects=True,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        },
    )
    for i, club in enumerate(clubs, 1):
        url = club.get("website")
        if not url or not url.startswith("http"):
            continue

        # Candidate pages, most specific first: the stored URL (often already
        # the tournament page), then the homepage, then likely subpages.
        base = homepage_of(url)
        if not base:
            continue
        pages = [] if url.lower().endswith(FILE_SUFFIXES) else [url]
        pages.append(base)
        pages += [base + p for p in TOURNAMENT_SUBPAGES]

        print(f"[{i}/{len(clubs)}] {club['name']}", flush=True)
        found: dict = {}
        reached = False
        for page in pages:
            try:
                time.sleep(delay)
                resp = client.get(page)
                if resp.status_code != 200:
                    continue
                reached = True
                found.update(scan(resp.text))
                # Stop on a live feed only. A PDF is a fallback source, so keep
                # reading the remaining pages in case the club also runs a
                # platform we can query properly.
                if found.get("tournament_platform") in ("pccaddie", "albatros", "nexxchange"):
                    break
            except Exception:
                continue

        update = {k: v for k, v in found.items() if v and not club.get(k)}
        # Distinguish "we looked and found no known system" from "never looked".
        # Without this the next run re-scans the same dead ends forever, and the
        # coverage gap looks like a scraper backlog when it is really a club
        # publishing its calendar as a PDF.
        if reached and not found.get("tournament_platform") and not club.get("tournament_platform"):
            update["tournament_platform"] = "unknown"

        if update:
            print(f"  ✓ {update}", flush=True)
            updates[club["id"]] = update
            # Persist as we go. A full region scan is ~90 minutes of network
            # I/O; accumulating everything for a single write at the end means
            # one timeout or Ctrl-C throws away the whole run.
            if on_found:
                on_found(club["id"], update)
    client.close()
    return updates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--fetch", action="store_true", help="also scan club websites (network)")
    ap.add_argument("--region", help="limit to clubs in this region value")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    ap.add_argument("--rescan", action="store_true",
                    help="also revisit clubs already scanned and marked unknown")
    args = ap.parse_args()

    db = Database()
    # Select "*" rather than naming the new columns: naming one that does not
    # exist yet fails inside PostgREST before any guard here could report it,
    # producing a raw APIError instead of a usable message.
    rows, start = [], 0
    while True:
        r = db.client.table("golf_clubs").select("*").range(start, start + 999).execute()
        rows += r.data
        if len(r.data) < 1000:
            break
        start += 1000

    for column, migration in (("tournament_platform", "026_tournament_platforms.sql"),
                              ("albatros_id", "026_tournament_platforms.sql")):
        if rows and column not in rows[0]:
            sys.exit(f"golf_clubs.{column} is missing — apply "
                     f"db/migrations/{migration} first.")
    # Merged duplicates are never scraped, so discovering ids for them is waste.
    rows = [c for c in rows if not c.get("merged_into")]

    if args.region:
        # "Bayern" has to mean every Bavarian club, not just the 217 literally
        # tagged that way — the rest carry a Regierungsbezirk or "München".
        allowed = REGION_GROUPS.get(args.region, {args.region.lower()})
        rows = [c for c in rows if (c.get("region") or "").strip().lower() in allowed]
    # A club needs scanning when no platform has been identified for it yet.
    # Re-scanning ones already marked "unknown" only repeats a known dead end,
    # so --rescan is required to force that.
    missing = [
        c for c in rows
        if not c.get("pccaddie_id") and not c.get("albatros_id")
        and (args.rescan or not c.get("tournament_platform"))
    ]
    print(f"{len(rows)} clubs in scope, {len(missing)} with no known platform.\n")

    updates = offline_pass(missing)
    print(f"OFFLINE pass: recovered {len(updates)} from stored URLs.")
    for cid, up in updates.items():
        club = next(c for c in rows if c["id"] == cid)
        print(f"  {club['name'][:45]:47} {up}")

    written: set[str] = set()

    def persist(club_id: str, update: dict) -> None:
        # Re-read before writing. The `club` dicts were loaded at the start of
        # a run that takes over an hour, so their values are stale — an earlier
        # version overwrote a hand-corrected calendar_pdf_url with a dead link
        # it had found on the club's page.
        current = (db.client.table("golf_clubs").select("*")
                   .eq("id", club_id).single().execute().data or {})
        fresh = {k: v for k, v in update.items() if not current.get(k)}
        if fresh:
            db.client.table("golf_clubs").update(fresh).eq("id", club_id).execute()
        written.add(club_id)

    if args.fetch:
        remaining = [c for c in missing if c["id"] not in updates]
        print(f"\nONLINE pass: scanning {len(remaining)} club websites "
              f"at {args.delay}s/request.\n")
        updates.update(online_pass(remaining, args.delay,
                                   on_found=persist if args.apply else None))

    if args.apply:
        for cid, up in updates.items():
            if cid not in written:
                db.client.table("golf_clubs").update(up).eq("id", cid).execute()
        print(f"\nWrote {len(updates)} clubs.")
        print("Tournaments appear after the next scheduled scraper run.")
    else:
        print(f"\nDRY RUN — {len(updates)} clubs would be updated. Re-run with --apply.")


if __name__ == "__main__":
    main()
