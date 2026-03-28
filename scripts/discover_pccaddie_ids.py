"""Discover tournament platform IDs by scanning golf club websites.

Checks each club's website (and common tournament subpages) for references to:
- PC CADDIE (pccaddie.net/clubs/{id})
- Nexxchange (issuerId or nexxchange.com references)
- Albatros/BRS (albatros.net or aws-tournament references)

Stores discovered IDs in the database for use by tournament scrapers.
"""

import re
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.database import Database

# Patterns to detect tournament platforms
PCCADDIE_PATTERN = re.compile(r"pccaddie\.net/clubs/(\d+)", re.IGNORECASE)
NEXXCHANGE_ISSUER_PATTERN = re.compile(r"issuerId[\"':\s=]+([0-9a-f]{24})", re.IGNORECASE)
NEXXCHANGE_URL_PATTERN = re.compile(r"nexxchange\.com", re.IGNORECASE)
ALBATROS_PATTERN = re.compile(r"albatros\.net|aws-tournament", re.IGNORECASE)

TOURNAMENT_SUBPAGES = ["/turniere", "/turnierkalender", "/tournament", "/wettspiele", "/turniere/"]


def scan_html(html: str) -> dict:
    """Scan HTML for tournament platform references. Returns dict of found IDs."""
    results = {}

    # PC CADDIE
    pcc_match = PCCADDIE_PATTERN.search(html)
    if pcc_match:
        results["pccaddie_id"] = pcc_match.group(1)

    # Nexxchange
    nxx_match = NEXXCHANGE_ISSUER_PATTERN.search(html)
    if nxx_match:
        results["nexxchange_id"] = nxx_match.group(1)
    elif NEXXCHANGE_URL_PATTERN.search(html):
        results["nexxchange_detected"] = True

    # Albatros
    if ALBATROS_PATTERN.search(html):
        results["albatros_detected"] = True

    return results


def main():
    db = Database()

    # Get all clubs with a website that are missing at least one platform ID
    result = (
        db.client.table("golf_clubs")
        .select("id,name,website,pccaddie_id,nexxchange_id")
        .not_.is_("website", "null")
        .execute()
    )
    # Only scan clubs that are missing at least one ID
    clubs = [
        c for c in result.data
        if not c.get("pccaddie_id") or not c.get("nexxchange_id")
    ]
    print(f"[Discovery] Scanning {len(clubs)} club websites for tournament platforms.\n")

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

    stats = {"pccaddie": 0, "nexxchange": 0, "albatros": 0, "errors": 0, "none": 0}

    for i, club in enumerate(clubs):
        url = club["website"]
        if not url or not url.startswith("http"):
            continue

        print(f"[{i+1}/{len(clubs)}] {club['name']}: {url}")
        time.sleep(0.5)

        try:
            resp = client.get(url)
            combined = scan_html(resp.text)

            # If nothing found on main page, check tournament subpages
            if not combined.get("pccaddie_id") and not combined.get("nexxchange_id"):
                base = url.rstrip("/")
                for subpath in TOURNAMENT_SUBPAGES:
                    try:
                        time.sleep(0.3)
                        sub_resp = client.get(f"{base}{subpath}")
                        if sub_resp.status_code == 200:
                            sub_results = scan_html(sub_resp.text)
                            combined.update(sub_results)
                            if combined.get("pccaddie_id") or combined.get("nexxchange_id"):
                                break
                    except Exception:
                        continue

            # Update database with findings
            update = {}
            if combined.get("pccaddie_id") and not club.get("pccaddie_id"):
                update["pccaddie_id"] = combined["pccaddie_id"]
                stats["pccaddie"] += 1
                print(f"  ✓ PC CADDIE: {combined['pccaddie_id']}")

            if combined.get("nexxchange_id") and not club.get("nexxchange_id"):
                update["nexxchange_id"] = combined["nexxchange_id"]
                stats["nexxchange"] += 1
                print(f"  ✓ Nexxchange: {combined['nexxchange_id']}")

            if combined.get("albatros_detected"):
                stats["albatros"] += 1
                print(f"  ℹ Albatros detected (no scrapable ID)")

            if not combined:
                stats["none"] += 1

            if update:
                db.client.table("golf_clubs").update(update).eq("id", club["id"]).execute()

        except Exception as e:
            print(f"  ✗ Error: {e}")
            stats["errors"] += 1

    client.close()
    print(f"\n[Discovery] Done.")
    print(f"  PC CADDIE IDs found: {stats['pccaddie']}")
    print(f"  Nexxchange IDs found: {stats['nexxchange']}")
    print(f"  Albatros detected: {stats['albatros']}")
    print(f"  No platform found: {stats['none']}")
    print(f"  Errors: {stats['errors']}")


if __name__ == "__main__":
    main()
