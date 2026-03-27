"""Enrich golf club contact info from PC CADDIE club pages.

Extracts: address, postal_code, phone, email, website from the PC CADDIE
dashboard page for each club that has a PC CADDIE ID.
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bs4 import BeautifulSoup

from src.config import settings
from src.database import Database
from src.scrapers.pccaddie import PCCADDIE_CLUBS, PCCADDIE_BASE
from src.scrapers.base import BaseScraper


class PCCaddieClubEnricher(BaseScraper):
    source_name = "pccaddie_clubs"

    def run(self) -> None:
        all_clubs_db = {c["name"]: c for c in self.db.get_all_clubs()}
        updated = 0

        for club_name, pcc_id in PCCADDIE_CLUBS.items():
            url = f"{PCCADDIE_BASE}/{pcc_id}/app.php"
            print(f"\n[PC CADDIE] {club_name} ({pcc_id})")

            try:
                html = self.fetch(url)
            except Exception as e:
                print(f"  ✗ Failed: {e}")
                continue

            info = self._extract_contact_info(html)
            if not any(info.values()):
                print("  – No contact info found")
                continue

            # Find club in DB
            club = self._find_club(club_name, all_clubs_db)
            if not club:
                print(f"  ✗ Club not found in DB")
                continue

            # Only update fields that are missing or empty in DB
            updates = {}
            field_map = {
                "address": "address",
                "postal_code": "postal_code",
                "phone": "phone",
                "email": "email",
                "website": "website",
                "city": "city",
            }
            for info_key, db_key in field_map.items():
                new_val = info.get(info_key)
                old_val = club.get(db_key)
                if new_val and (not old_val or old_val.strip() == ""):
                    updates[db_key] = new_val

            if updates:
                updates["updated_at"] = "now()"
                self.db.client.table("golf_clubs").update(updates).eq("id", club["id"]).execute()
                updated += 1
                print(f"  ✓ Updated: {', '.join(updates.keys())}")
            else:
                print(f"  – Already complete")

        print(f"\n[PC CADDIE] Done. Updated {updated} clubs.")

    def _extract_contact_info(self, html: str) -> dict:
        soup = BeautifulSoup(html, "html.parser")
        info = {}

        # Find all dashboard-info labels and their sibling values
        for label in soup.find_all("span", class_="dashboard-info"):
            text = label.get_text(strip=True).rstrip(":")
            # Get the next sibling text/element
            parent = label.parent
            if not parent:
                continue

            if text == "Straße":
                # Street is plain text after the label
                val = parent.get_text(strip=True).replace("Straße:", "").strip()
                if val:
                    info["address"] = val

            elif text == "Postleitzahl":
                val = parent.get_text(strip=True).replace("Postleitzahl:", "").strip()
                if val:
                    info["postal_code"] = val.strip().zfill(5)

            elif text == "Ort":
                val = parent.get_text(strip=True).replace("Ort:", "").strip()
                if val:
                    info["city"] = val

            elif text == "Telefon":
                link = parent.find("a", href=re.compile(r"^tel:"))
                if link:
                    info["phone"] = link.get_text(strip=True)

            elif text in ("E-Mail", "Email"):
                link = parent.find("a", href=re.compile(r"^mailto:"))
                if link:
                    info["email"] = link.get_text(strip=True)

            elif text == "Homepage":
                link = parent.find("a", href=True)
                if link:
                    href = link["href"]
                    # Remove ?openext=yes tracking param
                    href = re.sub(r"\?openext=yes$", "", href)
                    if href:
                        info["website"] = href

        return info

    def _find_club(self, club_name: str, club_by_name: dict) -> dict | None:
        if club_name in club_by_name:
            return club_by_name[club_name]
        name_lower = club_name.lower()
        for name, club in club_by_name.items():
            if name_lower in name.lower() or name.lower() in name_lower:
                return club
        return self.db.find_club_by_name(club_name)


def main():
    print("=== Enriching Club Data from PC CADDIE ===\n")
    with PCCaddieClubEnricher() as scraper:
        scraper.run()


if __name__ == "__main__":
    main()
