"""Discover PC CADDIE IDs by checking golf club websites for pccaddie.net links.

Many German golf clubs embed their PC CADDIE tournament calendar on their website.
This script fetches each club's website and looks for pccaddie.net URLs to extract
the club's PC CADDIE ID, then stores it in the database.
"""

import re
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import settings
from src.database import Database

PCCADDIE_PATTERN = re.compile(
    r"pccaddie\.net/clubs/(\d+)", re.IGNORECASE
)


def main():
    db = Database()

    # Get clubs that have a website but no pccaddie_id yet
    result = (
        db.client.table("golf_clubs")
        .select("id,name,website,pccaddie_id")
        .not_.is_("website", "null")
        .is_("pccaddie_id", "null")
        .execute()
    )
    clubs = result.data
    print(f"[Discovery] {len(clubs)} clubs have a website but no PC CADDIE ID.\n")

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

    found = 0
    failed = 0
    no_pccaddie = 0

    for i, club in enumerate(clubs):
        url = club["website"]
        if not url or not url.startswith("http"):
            continue

        print(f"[{i+1}/{len(clubs)}] {club['name']}: {url}")
        time.sleep(0.5)

        try:
            resp = client.get(url)
            html = resp.text

            match = PCCADDIE_PATTERN.search(html)
            if match:
                pcc_id = match.group(1)
                db.client.table("golf_clubs").update(
                    {"pccaddie_id": pcc_id}
                ).eq("id", club["id"]).execute()
                print(f"  ✓ Found PC CADDIE ID: {pcc_id}")
                found += 1
            else:
                # Also check common subpages where the calendar might be embedded
                for subpath in ["/turniere", "/turnierkalender", "/tournament", "/wettspiele"]:
                    try:
                        base = url.rstrip("/")
                        sub_resp = client.get(f"{base}{subpath}")
                        sub_match = PCCADDIE_PATTERN.search(sub_resp.text)
                        if sub_match:
                            pcc_id = sub_match.group(1)
                            db.client.table("golf_clubs").update(
                                {"pccaddie_id": pcc_id}
                            ).eq("id", club["id"]).execute()
                            print(f"  ✓ Found PC CADDIE ID on {subpath}: {pcc_id}")
                            found += 1
                            break
                        time.sleep(0.3)
                    except Exception:
                        continue
                else:
                    no_pccaddie += 1

        except Exception as e:
            print(f"  ✗ Error: {e}")
            failed += 1

    client.close()
    print(f"\n[Discovery] Done. {found} IDs found, {no_pccaddie} without PC CADDIE, {failed} errors.")


if __name__ == "__main__":
    main()
