"""Discover candidate course-data assets across Bavarian club websites.

For each club with a `website` and `region='Bayern'`, this script:
  1. Fetches the homepage + a few common Platz / Course sub-paths
  2. Scans the HTML for links matching course-rating / scorecard PDF patterns
  3. Categorises each candidate (course_rating / birdiebook / platz_page / other)
  4. Inserts rows into course_data_candidates with status='discovered'

It does NOT download or parse PDFs — that's Phase 2 (extract_course_data.py).

Politeness:
  - 1.5s between requests (settings.request_delay_seconds)
  - Honors robots.txt — skips clubs that disallow our path
  - Sets German Accept-Language; identifies itself in the UA string

Idempotent: re-running just inserts new candidates that didn't exist before
(unique on club_id + asset_url).

Usage:
    python scripts/discover_course_assets.py            # all Bavarian clubs
    python scripts/discover_course_assets.py --limit 5  # first 5 (for testing)
    python scripts/discover_course_assets.py --club <club_id>  # single club
"""

import argparse
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from bs4 import BeautifulSoup

from src.config import settings
from src.database import Database


USER_AGENT = (
    "Mozilla/5.0 (compatible; ThePin-CoursePipeline/1.0; +https://thepin.app)"
)

# Paths to probe on each club website beyond "/" — kept short to stay polite.
# Most German clubs publish course info under one of these paths.
PROBE_PATHS = [
    "/platz/",
    "/platz",
    "/der-platz/",
    "/golfplatz/",
    "/course/",
    "/anlage/",
    "/spielbetrieb/platz/",
    "/golf/platz/",
]

# Link-text or URL fragments that strongly suggest a course-rating PDF.
COURSE_RATING_PATTERNS = re.compile(
    r"(course[ _-]?rating|cr[ _-]*slope|slope[ _-]*cr|platzdaten|"
    r"spielvorgabe|vorgabewirksam|platzbewertung|course[ _-]?handicap)",
    re.IGNORECASE,
)

# Patterns for birdiebook / scorecard with hole-by-hole detail.
BIRDIEBOOK_PATTERNS = re.compile(
    r"(birdie[ _-]?book|score[ _-]?karte|scorecard|hole[ _-]?by[ _-]?hole)",
    re.IGNORECASE,
)

# Path-segment based: matches /platz/, /platz, /der-platz/, /golfplatz/, etc.
# Avoids matching slugs that merely contain "platz" (e.g. /wildbienen-auf-dem-golfplatz/,
# /platzreife/, news articles).
PLATZ_PATH_SEGMENTS = re.compile(
    r"(?:^|/)(platz|der-platz|golfplatz|anlage|course|18[ _-]?loch[ _-]?platz)/?$",
    re.IGNORECASE,
)

# Slugs that look platz-ish but are actually noise (articles, courses, etc.).
PLATZ_NEGATIVE = re.compile(
    r"(artikel|news|nachricht|blog|aktuell|wildbienen|schnupperkurs|"
    r"platzreife(?:kurs)?|liga|turnier|veranstalt|kalender|gespert)",
    re.IGNORECASE,
)

# Per-asset-type caps so the high-signal PDFs are never evicted by low-signal
# Platz pages. The extractor only looks at course_rating; the others are kept
# for later enrichment passes.
ASSET_TYPE_CAPS = {
    "course_rating": 6,
    "birdiebook": 4,
    "platz_page": 6,
}

# Insertion priority — when we sort candidates we want the most useful first
# so the summary print shows PDFs, not landing pages.
ASSET_TYPE_PRIORITY = {
    "course_rating": 0,
    "birdiebook": 1,
    "platz_page": 2,
}


def is_pdf_link(href: str) -> bool:
    return href.lower().split("?")[0].endswith(".pdf")


def normalize_url(base: str, href: str) -> str | None:
    if not href:
        return None
    if href.startswith(("javascript:", "mailto:", "tel:", "#")):
        return None
    full = urljoin(base, href)
    parsed = urlparse(full)
    if parsed.scheme not in ("http", "https"):
        return None
    return full


def categorise(link_text: str, href: str, base_host: str | None = None) -> str | None:
    """Return asset_type for this link, or None if it's not interesting."""
    haystack = f"{link_text} {href}"
    if is_pdf_link(href):
        if COURSE_RATING_PATTERNS.search(haystack):
            return "course_rating"
        if BIRDIEBOOK_PATTERNS.search(haystack):
            return "birdiebook"
        return None  # other PDFs (rules, news) are not useful

    # HTML page candidates. Reject obvious noise first.
    if PLATZ_NEGATIVE.search(haystack):
        return None
    # Only follow same-host links — external pages aren't this club's data.
    if base_host:
        try:
            href_host = urlparse(href).netloc
            if href_host and href_host != base_host:
                return None
        except Exception:
            return None

    # Path segment must end in /platz/, /golfplatz/, etc.
    try:
        path = urlparse(href).path
    except Exception:
        return None
    if PLATZ_PATH_SEGMENTS.search(path):
        return "platz_page"
    return None


def harvest_pdfs_from_page(
    client: httpx.Client,
    robots_cache: dict,
    base_url: str,
    page_url: str,
) -> list[tuple[str, str]]:
    """Fetch an HTML page that looks like a course-rating landing and harvest
    embedded PDF links matching course_rating / birdiebook patterns.

    Returns a list of (asset_url, asset_type).
    """
    if not robots_allows(robots_cache, base_url, urlparse(page_url).path or "/"):
        return []
    try:
        time.sleep(settings.request_delay_seconds)
        resp = client.get(page_url)
        if resp.status_code != 200:
            return []
        if "html" not in resp.headers.get("content-type", "").lower():
            return []
    except Exception:
        return []

    found: list[tuple[str, str]] = []
    soup = BeautifulSoup(resp.text, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(" ", strip=True)
        full = normalize_url(page_url, href)
        if not full or not is_pdf_link(full):
            continue
        haystack = f"{text} {full}"
        if COURSE_RATING_PATTERNS.search(haystack):
            found.append((full, "course_rating"))
        elif BIRDIEBOOK_PATTERNS.search(haystack):
            found.append((full, "birdiebook"))
    return found


def robots_allows(robots_cache: dict, base_url: str, path: str) -> bool:
    """Cache robots.txt per host; return True if path is fetchable."""
    host = urlparse(base_url).netloc
    if host not in robots_cache:
        rp = RobotFileParser()
        try:
            rp.set_url(urljoin(base_url, "/robots.txt"))
            rp.read()
        except Exception:
            # If robots.txt is unreachable, default to allowed (standard behavior).
            rp = None
        robots_cache[host] = rp
    rp = robots_cache[host]
    if rp is None:
        return True
    try:
        return rp.can_fetch(USER_AGENT, urljoin(base_url, path))
    except Exception:
        return True


def discover_for_club(
    client: httpx.Client,
    robots_cache: dict,
    db: Database,
    club: dict,
) -> int:
    """Crawl one club's website. Returns count of new candidates inserted."""
    club_id = club["id"]
    name = club["name"]
    website = club.get("website")
    if not website:
        print(f"  – {name}: no website on file")
        return 0

    # Normalize to root URL (some `website` values include trailing paths).
    # Many `golf_clubs.website` values are stale http:// while the server now
    # serves https:// only with port 80 closed. Probe both and pick whichever
    # responds, so we don't bail on a refused HTTP connection.
    parsed = urlparse(website)
    base_url = f"{parsed.scheme}://{parsed.netloc}/"
    base_host = parsed.netloc

    if parsed.scheme == "http":
        # Try https first — if it works, prefer it.
        try:
            time.sleep(settings.request_delay_seconds)
            r = client.get(f"https://{parsed.netloc}/")
            if r.status_code < 400 and "html" in r.headers.get("content-type", "").lower():
                base_url = f"https://{parsed.netloc}/"
                print(f"      (upgraded http→https for {parsed.netloc})")
        except Exception:
            pass  # fall back to http

    candidates: list[dict] = []
    visited_urls: set[str] = set()
    candidate_asset_urls: set[str] = set()
    type_counts: dict[str, int] = {}
    # HTML pages whose own URL/text strongly suggests a CR landing page —
    # worth a one-hop follow to harvest embedded PDF links.
    cr_landing_pages: list[str] = []

    def add_candidate(source_url: str, asset_url: str, asset_type: str):
        if asset_url in candidate_asset_urls:
            return
        if type_counts.get(asset_type, 0) >= ASSET_TYPE_CAPS.get(asset_type, 6):
            return
        candidate_asset_urls.add(asset_url)
        type_counts[asset_type] = type_counts.get(asset_type, 0) + 1
        candidates.append({
            "club_id": club_id,
            "source_url": source_url,
            "asset_url": asset_url,
            "asset_type": asset_type,
        })

    # Pages to scan: root + a few common Platz paths
    pages_to_scan = [base_url] + [
        urljoin(base_url, path) for path in PROBE_PATHS
    ]

    pages_reached = 0
    pages_skipped: list[tuple[str, str]] = []  # (url, reason)
    for page_url in pages_to_scan:
        if page_url in visited_urls:
            continue
        visited_urls.add(page_url)

        if not robots_allows(robots_cache, base_url, urlparse(page_url).path or "/"):
            pages_skipped.append((page_url, "robots"))
            continue

        try:
            time.sleep(settings.request_delay_seconds)
            resp = client.get(page_url)
            if resp.status_code != 200:
                pages_skipped.append((page_url, f"http {resp.status_code}"))
                continue
            content_type = resp.headers.get("content-type", "").lower()
            if "html" not in content_type:
                pages_skipped.append((page_url, f"non-html ({content_type})"))
                continue
        except Exception as e:
            pages_skipped.append((page_url, f"err: {type(e).__name__}"))
            continue
        pages_reached += 1

        soup = BeautifulSoup(resp.text, "html.parser")
        # Always include the page itself as a platz_page candidate if its URL
        # path segment looks platz-ish — useful for description-text extraction later.
        try:
            page_path = urlparse(page_url).path
        except Exception:
            page_path = ""
        if PLATZ_PATH_SEGMENTS.search(page_path) and not PLATZ_NEGATIVE.search(page_url):
            add_candidate(page_url, page_url, "platz_page")

        for a in soup.find_all("a", href=True):
            text = a.get_text(" ", strip=True)
            href = a["href"]
            full = normalize_url(page_url, href)
            if not full:
                continue
            asset_type = categorise(text, full, base_host)
            if asset_type:
                add_candidate(page_url, full, asset_type)

            # Same-host HTML pages whose URL or link-text screams "course
            # rating" — schedule a one-hop follow to find embedded PDFs.
            if (
                not is_pdf_link(full)
                and urlparse(full).netloc == base_host
                and COURSE_RATING_PATTERNS.search(f"{text} {full}")
            ):
                if full not in cr_landing_pages and full not in visited_urls:
                    cr_landing_pages.append(full)

    # One-hop follow into pages that look like CR landing pages but aren't
    # themselves PDFs. Cap at 3 follows per club to stay polite.
    follow_results: list[tuple[str, int]] = []
    for landing in cr_landing_pages[:3]:
        if type_counts.get("course_rating", 0) >= ASSET_TYPE_CAPS["course_rating"]:
            break
        harvested = harvest_pdfs_from_page(client, robots_cache, base_url, landing)
        follow_results.append((landing, len(harvested)))
        for asset_url, asset_type in harvested:
            add_candidate(landing, asset_url, asset_type)

    if not candidates:
        # Print enough context to diagnose why. Most common causes:
        # site unreachable / robots block / HTML structure no longer matches.
        print(f"  – {name}: no candidates found")
        print(f"      pages reached: {pages_reached}/{len(pages_to_scan)}")
        if pages_skipped:
            for url, reason in pages_skipped[:5]:
                print(f"        skipped {reason}: {url}")
        if cr_landing_pages:
            print(f"      cr_landing_pages seen: {len(cr_landing_pages)}")
            for url, n in follow_results:
                print(f"        followed (found {n} PDFs): {url}")
        return 0

    # Insert (idempotent via unique constraint)
    inserted = 0
    for cand in candidates:
        try:
            res = (
                db.client.table("course_data_candidates")
                .upsert(cand, on_conflict="club_id,asset_url", ignore_duplicates=True)
                .execute()
            )
            if res.data:
                inserted += 1
        except Exception as e:
            print(f"    ! insert error for {cand['asset_url']}: {e}")

    # Sort by priority for the summary so PDFs are visible first.
    candidates.sort(key=lambda c: ASSET_TYPE_PRIORITY.get(c["asset_type"], 9))
    counts_str = ", ".join(f"{t}:{n}" for t, n in sorted(type_counts.items()))
    print(f"  ✓ {name}: {len(candidates)} candidates ({inserted} new) [{counts_str}]")
    for c in candidates[:5]:
        print(f"      {c['asset_type']:14s} {c['asset_url']}")
    if len(candidates) > 5:
        print(f"      … + {len(candidates) - 5} more")
    return inserted


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Max clubs to process")
    parser.add_argument("--club", type=str, default=None, help="Process a single club by id")
    parser.add_argument("--region", type=str, default="Bayern", help="Region filter")
    args = parser.parse_args()

    if not settings.supabase_service_key:
        print(
            "ERROR: SUPABASE_SERVICE_KEY is not set in .env.\n"
            "  This script writes to course_data_candidates, which is RLS-protected.\n"
            "  Add the service_role key from Supabase → project settings → API.\n"
            "  (Keep it server-side only; never expose it to the web app.)"
        )
        sys.exit(1)

    db = Database(service_role=True)

    q = db.client.table("golf_clubs").select("id,name,website,region")
    if args.club:
        q = q.eq("id", args.club)
    else:
        q = q.eq("region", args.region).not_.is_("website", "null").neq("website", "")
    if args.limit:
        q = q.limit(args.limit)

    clubs = q.execute().data or []
    print(f"=== Discovering course assets for {len(clubs)} club(s) ===\n")

    client = httpx.Client(
        timeout=settings.request_timeout_seconds,
        follow_redirects=True,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
    )
    robots_cache: dict = {}

    total_new = 0
    for i, club in enumerate(clubs, 1):
        print(f"[{i}/{len(clubs)}] {club['name']}")
        try:
            total_new += discover_for_club(client, robots_cache, db, club)
        except Exception as e:
            print(f"  ! error: {e}")

    client.close()
    print(f"\n=== Done. {total_new} new candidates discovered. ===")
    print("Next: run scripts/extract_course_data.py to extract PDFs.")


if __name__ == "__main__":
    main()
