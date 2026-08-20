"""Merge duplicate golf_clubs rows onto a single canonical row.

The same physical club sits in golf_clubs several times because each source
spells it differently — "GC Am Reichswald" / "GC Am Reichswald e. V.",
"Golfclub Eschenried e.V. – Eschenhof" / "Münchner Golf Eschenried - Platz
Eschenhof". Tournaments land on whichever row the scraper matched, so the
twins render as clubs that never host anything. That is the biggest single
cause of "this club has no tournaments" feedback.

Unlike scripts/dedup_clubs.py (which groups on one exact normalised name and
then DELETEs), this script:

  * groups on three independent signals, strongest first — shared pccaddie_id,
    normalised name + same town, identical coordinates — because no single
    signal catches all of the real duplicates;
  * keeps the duplicate row and sets golf_clubs.merged_into instead of
    deleting, so indexed club URLs keep resolving (the app 301s them) and
    saved_clubs / profiles.home_club_id references survive;
  * is dry-run by default.

Requires migration 023_club_merging.sql.

Usage:
    python scripts/merge_duplicate_clubs.py                 # dry run, all regions
    python scripts/merge_duplicate_clubs.py --region Bayern # dry run, Bavaria only
    python scripts/merge_duplicate_clubs.py --apply         # write
"""

import argparse
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import Database

# Bavaria arrives tagged as the Bundesland, as a Regierungsbezirk, or as the
# city of München, depending on the source. Mirrors RAW_REGION_ALIASES in
# web/lib/regions.ts — keep the two in step.
REGION_GROUPS = {
    "Bayern": {
        "bayern", "oberbayern", "niederbayern", "schwaben", "oberpfalz",
        "oberfranken", "mittelfranken", "unterfranken", "münchen", "muenchen",
    },
}

# Fields worth copying from a duplicate onto the keeper when the keeper is
# missing them. A merge should never lose contact details or a platform id.
FILLABLE = [
    "address", "city", "postal_code", "region", "latitude", "longitude",
    "website", "bgv_url", "phone", "email", "logo_url", "pccaddie_id",
    "nexxchange_id", "courses", "course_data", "has_9_holes", "has_18_holes",
]


def normalize_name(name: str) -> str:
    """Aggressively normalise a club name to a comparable token set.

    Deliberately stronger than src.club_matching.normalize_club_name, which has
    to stay conservative because it matches free-text tournament venue strings
    onto clubs — a false positive there mislabels a tournament. Here a false
    positive only ever merges two rows we also cross-check on town or
    coordinates, so we can fold umlauts, drop legal suffixes and compare as an
    unordered token set. That last part is what catches word-order variants
    like "Tegernseer Golf-Club Bad Wiessee" vs "Tegernseer GC Bad Wiessee".
    """
    s = unicodedata.normalize("NFKD", name.lower())
    s = s.replace("ä", "a").replace("ö", "o").replace("ü", "u").replace("ß", "ss")
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"\be\.?\s*v\.?\b", " ", s)
    s = re.sub(r"\b(gmbh|co|kg|ag|mbh)\b", " ", s)
    # Every way a German club writes "golf club" collapses to one token.
    s = re.sub(r"golf[\s\-]*(und|&)?[\s\-]*(club|verein|anlage|park|resort|platz|landclub|land[\s\-]*club|country[\s\-]*club)", " gc ", s)
    s = re.sub(r"\b(glc|gcc|ga|gp|gr|gv)\b", " gc ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    tokens = [t for t in s.split() if t]
    return " ".join(sorted(set(tokens)))


def town_key(club: dict) -> str:
    """Coarse town key. Truncated because the same town is spelled several ways
    ("Velburg" / "Velburg-Unterwiesenacker", "München" / "München-Thalkirchen")."""
    return (club.get("city") or "").strip().lower()[:6]


def geo_key(club: dict):
    lat, lng = club.get("latitude"), club.get("longitude")
    if lat is None or lng is None:
        return None
    # ~100 m. Two rows this close are on the same site.
    return (round(lat, 3), round(lng, 3))


# Domains that host many unrelated clubs — a shared host here says nothing
# about the rows being the same club.
PLATFORM_HOSTS = {
    "pccaddie.net", "nexxchange.com", "golf.de", "clubadmin.de",
    "golfonlinetool.org", "buchung.golf-absolute.de", "albatros.net",
}


def host_key(club: dict) -> str | None:
    """Registrable host of the club's website, or None for platform URLs.

    A club's own domain is a strong identity signal that name and coordinate
    matching both miss: the eight Münchner Golf Eschenried rows share
    muenchner-golf-eschenried.de but spell their names too differently to
    match, and several lack coordinates entirely.
    """
    url = club.get("website")
    if not url:
        return None
    try:
        netloc = urlparse(url).netloc.lower()
    except ValueError:
        return None
    host = netloc.split("@")[-1].split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    if not host or host in PLATFORM_HOSTS:
        return None
    return host


# Tokens that survive normalisation but say nothing about *which* club this is.
# Without this, "Beckenbauer Golf Course" and "Porsche Golf Course" — two
# genuinely different courses at the same Bad Griesbach resort — look related
# because they share "golf" and "course".
GENERIC_TOKENS = {
    "gc", "golf", "course", "club", "courses", "resort", "park", "anlage",
    "platz", "land", "county", "country", "sport", "sports", "freizeit",
    "zentrum", "golfzentrum", "der", "die", "das", "und", "am", "im", "an",
    "bei", "von", "zu", "in", "1", "2", "18", "9",
}


def distinctive_tokens(name: str) -> set[str]:
    """Normalised tokens that actually identify the club."""
    return {t for t in normalize_name(name).split() if t not in GENERIC_TOKENS and len(t) > 2}


def same_club(a: dict, b: dict) -> bool:
    """Corroborated duplicate test.

    Every signal here needs a second signal to agree, because each one alone
    produces false merges on real data:

      * a shared pccaddie_id can mean a club without its own course books
        through another club's calendar (HVB-Club München on Schloßberg's
        PC CADDIE) — those are two different clubs;
      * identical coordinates happen both for resorts with several distinct
        courses and for rows the geocoder could only resolve to a town
        centroid;
      * an identical normalised name in two different towns is usually two
        clubs that happen to be named after the same thing.

    Requiring a location signal AND a name signal to line up removes all of
    those without losing the true duplicates, which agree on both.
    """
    shared_name = bool(distinctive_tokens(a["name"]) & distinctive_tokens(b["name"]))
    same_town = bool(town_key(a)) and town_key(a) == town_key(b)
    same_site = geo_key(a) is not None and geo_key(a) == geo_key(b)
    same_host = host_key(a) is not None and host_key(a) == host_key(b)

    if a["pccaddie_id"] and a["pccaddie_id"] == b["pccaddie_id"]:
        return shared_name or same_town or same_site
    if normalize_name(a["name"]) == normalize_name(b["name"]):
        return same_town or same_site
    # Own domain, or same coordinates, plus a name token that identifies the
    # club. The name half is what keeps Bad Griesbach's seven Quellness courses
    # apart — they share quellness-golf.com but "Porsche Golf Course" and
    # "Beckenbauer Golf Course" have no identifying token in common.
    if same_site or same_host:
        return shared_name
    return False


def group_duplicates(clubs: list[dict]) -> list[list[dict]]:
    """Union-find over corroborated pairs. Returns groups of 2+ rows.

    Pairs are only compared inside candidate buckets (same pccaddie_id, same
    normalised name, same coordinates) so this stays linear-ish instead of
    comparing all ~935 clubs against each other.
    """
    parent = {c["id"]: c["id"] for c in clubs}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    by_id = {c["id"]: c for c in clubs}
    candidates: dict[str, list[str]] = defaultdict(list)
    for c in clubs:
        if c["pccaddie_id"]:
            candidates[f"pc:{c['pccaddie_id']}"].append(c["id"])
        candidates[f"nm:{normalize_name(c['name'])}"].append(c["id"])
        g = geo_key(c)
        if g:
            candidates[f"geo:{g}"].append(c["id"])
        h = host_key(c)
        if h:
            candidates[f"host:{h}"].append(c["id"])

    for ids in candidates.values():
        if len(ids) < 2:
            continue
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                if same_club(by_id[a], by_id[b]):
                    union(a, b)

    groups = defaultdict(list)
    for c in clubs:
        groups[find(c["id"])].append(c)
    return [g for g in groups.values() if len(g) > 1]


def completeness(club: dict) -> int:
    return sum(1 for f in FILLABLE if club.get(f) not in (None, "", []))


# A spaced dash usually separates a club from one of its courses:
# "Münchner Golf Eschenried - Platz Eschenhof". Unspaced hyphens are part of
# ordinary German names ("GC Lindau-Bad Schachen") and must not match.
_COURSE_SUFFIX = re.compile(r"\s[-–—]\s")


def names_the_club(club: dict) -> bool:
    """True when the name reads as the club itself rather than one of its courses."""
    return not _COURSE_SUFFIX.search(club["name"])


def pick_keeper(group: list[dict], upcoming: Counter, total: Counter) -> dict:
    """The row users should land on.

    Tournament count dominates: the row the scrapers actually feed is the row
    that stays useful tomorrow, and it is the one already accumulating inbound
    links.

    Only when nothing has tournaments does the name matter — and there it
    matters a lot, because the survivor becomes the club page title. Eight
    Eschenried rows all sit at zero, and picking on completeness alone titled
    the club "Golfclub Eschenried e.V. – Gröbenbach", naming the whole club
    after one of its three courses. Preferring a name with no course suffix
    picks "Münchner Golf Eschenried" instead.
    """
    return max(
        group,
        key=lambda c: (
            upcoming.get(c["id"], 0),
            total.get(c["id"], 0),
            names_the_club(c),
            completeness(c),
            c["id"],
        ),
    )


def fetch_all(db, table: str, columns: str) -> list[dict]:
    rows, start, page = [], 0, 1000
    while True:
        r = db.client.table(table).select(columns).range(start, start + page - 1).execute()
        rows += r.data
        if len(r.data) < page:
            return rows
        start += page


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--region", help="limit to one region group, e.g. Bayern")
    ap.add_argument("--limit", type=int, help="only process the first N groups")
    args = ap.parse_args()

    db = Database()

    # This script is the one caller that must see merged rows too, so it can
    # detect an already-merged group and leave it alone.
    clubs = fetch_all(db, "golf_clubs", "*")
    sample = clubs[0] if clubs else {}
    required = {
        "merged_into": "023_club_merging.sql",
        "also_known_as": "025_club_also_known_as.sql",
    }
    absent = {col: mig for col, mig in required.items() if col not in sample}
    if absent:
        detail = ", ".join(f"golf_clubs.{c} (db/migrations/{m})" for c, m in absent.items())
        if args.apply:
            sys.exit(f"Missing column(s): {detail}. Apply the migration(s) first.")
        print(f"NOTE: missing {detail} — apply before --apply.\n")

    # Never re-merge something already merged.
    clubs = [c for c in clubs if not c.get("merged_into")]

    if args.region:
        allowed = REGION_GROUPS.get(args.region, {args.region.lower()})
        clubs = [c for c in clubs if (c.get("region") or "").strip().lower() in allowed]
    print(f"Considering {len(clubs)} canonical clubs"
          f"{f' in {args.region}' if args.region else ''}.\n")

    tours = fetch_all(db, "tournaments", "id,name,date_start,source,club_id")
    today = date.today().isoformat()
    upcoming = Counter(t["club_id"] for t in tours if t["date_start"] >= today)
    total = Counter(t["club_id"] for t in tours)
    tours_by_club = defaultdict(list)
    for t in tours:
        tours_by_club[t["club_id"]].append(t)

    groups = group_duplicates(clubs)
    groups.sort(key=lambda g: -max(upcoming.get(c["id"], 0) for c in g))
    if args.limit:
        groups = groups[: args.limit]

    print(f"Found {len(groups)} duplicate groups covering {sum(len(g) for g in groups)} rows.\n")

    moved_total = dropped_total = rescued = 0

    for g in groups:
        keeper = pick_keeper(g, upcoming, total)
        losers = [c for c in g if c["id"] != keeper["id"]]

        # A group is only "rescued" if a row users currently see as empty gains
        # tournaments — that is the metric the feedback is about.
        rescued += sum(1 for c in losers if upcoming.get(c["id"], 0) == 0) if upcoming.get(keeper["id"], 0) else 0

        print(f"KEEP  {keeper['name']!r} ({keeper['city']}) "
              f"[{upcoming.get(keeper['id'], 0)} upcoming] {keeper['id']}")

        # The keeper must not lose data the duplicates carried.
        keeper_updates = {}
        for loser in losers:
            for f in FILLABLE:
                if keeper.get(f) in (None, "", []) and loser.get(f) not in (None, "", []) \
                        and f not in keeper_updates:
                    keeper_updates[f] = loser[f]

        # Record the names being collapsed. For a club like Münchner Golf
        # Eschenried these are its actual courses (Eschenhof, Gröbenbach,
        # Gut Häusern) — the club page lists them and search matches them, so
        # a golfer who knows the course by name still finds the club.
        aliases = {n for n in (keeper.get("also_known_as") or []) if n}
        for loser in losers:
            if normalize_name(loser["name"]) != normalize_name(keeper["name"]):
                aliases.add(loser["name"].strip())
        aliases.discard(keeper["name"].strip())
        if aliases != set(keeper.get("also_known_as") or []):
            keeper_updates["also_known_as"] = sorted(aliases)

        # tournaments has a unique index on (name, date_start, club_id, source),
        # so a tournament moving onto the keeper collides whenever the keeper
        # already has the same event from the same source. Those are genuine
        # duplicates of each other — drop the loser's copy rather than move it.
        keeper_sig = {(t["name"], t["date_start"], t["source"]) for t in tours_by_club[keeper["id"]]}
        for loser in losers:
            move, drop = [], []
            for t in tours_by_club[loser["id"]]:
                sig = (t["name"], t["date_start"], t["source"])
                (drop if sig in keeper_sig else move).append(t)
                keeper_sig.add(sig)

            print(f"  merge {loser['name']!r} ({loser['city']}) "
                  f"[{upcoming.get(loser['id'], 0)} upcoming] "
                  f"→ move {len(move)}, drop {len(drop)} tournaments")
            moved_total += len(move)
            dropped_total += len(drop)

            if not args.apply:
                continue

            if move:
                for i in range(0, len(move), 200):
                    chunk = [t["id"] for t in move[i:i + 200]]
                    db.client.table("tournaments").update(
                        {"club_id": keeper["id"]}).in_("id", chunk).execute()
            if drop:
                for i in range(0, len(drop), 200):
                    chunk = [t["id"] for t in drop[i:i + 200]]
                    db.client.table("tournaments").delete().in_("id", chunk).execute()

            # saved_clubs is PK(user_id, club_id): re-point only the users who
            # do not already have the keeper saved, then clear the rest.
            saved = db.client.table("saved_clubs").select("user_id").eq(
                "club_id", loser["id"]).execute().data
            if saved:
                keeper_users = {
                    r["user_id"] for r in db.client.table("saved_clubs")
                    .select("user_id").eq("club_id", keeper["id"]).execute().data
                }
                for row in saved:
                    if row["user_id"] in keeper_users:
                        db.client.table("saved_clubs").delete().eq(
                            "club_id", loser["id"]).eq("user_id", row["user_id"]).execute()
                    else:
                        db.client.table("saved_clubs").update(
                            {"club_id": keeper["id"]}).eq("club_id", loser["id"]).eq(
                            "user_id", row["user_id"]).execute()

            # Anyone whose home club was the duplicate should keep a home club.
            db.client.table("profiles").update(
                {"home_club_id": keeper["id"]}).eq("home_club_id", loser["id"]).execute()

            db.client.table("golf_clubs").update(
                {"merged_into": keeper["id"]}).eq("id", loser["id"]).execute()

        if keeper_updates and args.apply:
            db.client.table("golf_clubs").update(keeper_updates).eq("id", keeper["id"]).execute()
        if keeper_updates:
            print(f"  fill keeper: {', '.join(sorted(keeper_updates))}")
        print()

    print("─" * 60)
    print(f"groups: {len(groups)}  rows merged away: {sum(len(g) - 1 for g in groups)}")
    print(f"tournaments moved: {moved_total}  duplicate tournaments dropped: {dropped_total}")
    print(f"club pages that stop looking empty: ~{rescued}")
    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")


if __name__ == "__main__":
    main()
