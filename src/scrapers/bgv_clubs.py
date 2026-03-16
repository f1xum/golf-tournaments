"""Scrape all golf clubs from the BGV club directory."""

import re

from bs4 import BeautifulSoup

from src.config import settings
from src.models.club import GolfClub
from src.scrapers.base import BaseScraper


class BGVClubsScraper(BaseScraper):
    source_name = "bgv_clubs"
    total_pages = 13

    def run(self) -> None:
        all_clubs: list[GolfClub] = []

        for page in range(1, self.total_pages + 1):
            url = f"{settings.bgv_base_url}{settings.bgv_clubs_path}?page_e38={page}"
            print(f"[BGV Clubs] Fetching page {page}/{self.total_pages}: {url}")

            html = self.fetch(url)
            club_slugs = self._parse_listing_page(html)

            for slug, region, city in club_slugs:
                try:
                    detail_url = f"{settings.bgv_base_url}/golfclub/{slug}"
                    detail_html = self.fetch(detail_url)
                    club = self._parse_detail_page(detail_html, slug, region, city)
                    if club:
                        club.bgv_url = detail_url
                        all_clubs.append(club)
                        print(f"  ✓ {club.name} ({club.city})")
                except Exception as e:
                    error_msg = f"Failed to scrape club {slug}: {e}"
                    print(f"  ✗ {error_msg}")
                    if hasattr(self, "_ctx"):
                        self._ctx.errors.append(error_msg)

        # Deduplicate by (name, city) before upserting
        seen = set()
        unique_clubs = []
        for c in all_clubs:
            key = (c.name, c.city)
            if key not in seen:
                seen.add(key)
                unique_clubs.append(c)

        # Upsert to database
        if unique_clubs:
            rows = [c.to_db_row() for c in unique_clubs]
            self.db.upsert_clubs(rows)
            all_clubs = unique_clubs

        if hasattr(self, "_ctx"):
            self._ctx.items_found = len(all_clubs)
            self._ctx.items_created = len(all_clubs)

        print(f"\n[BGV Clubs] Done. {len(all_clubs)} clubs scraped.")

    def _parse_listing_page(self, html: str) -> list[tuple[str, str, str]]:
        """Extract club slugs, regions, and cities from a listing page.

        Returns list of (slug, region, city) tuples.
        """
        soup = BeautifulSoup(html, "html.parser")
        clubs = []

        # Find all links to club detail pages
        for link in soup.find_all("a", href=re.compile(r"^golfclub/")):
            href = link.get("href", "")
            slug = href.replace("golfclub/", "").strip("/")
            if not slug or slug in [c[0] for c in clubs]:
                continue

            # Try to find region and city from surrounding text
            region = ""
            city = ""
            parent = link.find_parent()
            if parent:
                text = parent.get_text(separator="|", strip=True)
                # Look for pattern "Region, City" near the link
                parts = text.split("|")
                for part in parts:
                    if "," in part and len(part.split(",")) == 2:
                        r, c = part.split(",", 1)
                        region = r.strip()
                        city = c.strip()
                        break

            clubs.append((slug, region, city))

        return clubs

    def _parse_detail_page(
        self, html: str, slug: str, region: str, city: str
    ) -> GolfClub | None:
        """Parse a club detail page for contact info."""
        soup = BeautifulSoup(html, "html.parser")

        # Club name — usually the main heading
        name_tag = soup.find("h1") or soup.find("h2")
        name = name_tag.get_text(strip=True) if name_tag else slug.replace("-", " ").title()

        # Find address, phone, email, website from the page text
        page_text = soup.get_text(separator="\n", strip=True)

        address = self._extract_address(page_text)
        postal_code, parsed_city = self._extract_postal_city(page_text)
        phone = self._extract_phone(soup)
        email = self._extract_email(soup)
        website = self._extract_website(soup)
        logo_url = self._extract_logo(soup)

        return GolfClub(
            name=name,
            address=address,
            city=parsed_city or city,
            postal_code=postal_code,
            region=region or None,
            website=website,
            phone=phone,
            email=email,
            logo_url=logo_url,
        )

    def _extract_address(self, text: str) -> str | None:
        """Try to find a German street address pattern."""
        # Matches patterns like "Am Golfplatz 19" or "Münchener Str. 42"
        match = re.search(
            r"([A-ZÄÖÜ][a-zäöüß\-]+(?:\s+[a-zäöüß\-]+)*\.?\s+\d+[a-z]?)\s*[,\n]",
            text,
        )
        return match.group(1).strip() if match else None

    def _extract_postal_city(self, text: str) -> tuple[str | None, str | None]:
        """Extract German postal code + city pattern (e.g. '91183 Abenberg')."""
        match = re.search(r"\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ\s\-]+)", text)
        if match:
            return match.group(1), match.group(2).strip()
        return None, None

    def _extract_phone(self, soup: BeautifulSoup) -> str | None:
        tel_link = soup.find("a", href=re.compile(r"^tel:"))
        if tel_link:
            return tel_link.get_text(strip=True) or tel_link["href"].replace("tel:", "")
        return None

    def _extract_email(self, soup: BeautifulSoup) -> str | None:
        email_link = soup.find("a", href=re.compile(r"^mailto:"))
        if email_link:
            return email_link["href"].replace("mailto:", "").strip()
        return None

    def _extract_website(self, soup: BeautifulSoup) -> str | None:
        """Find external website link (not BGV internal links)."""
        for link in soup.find_all("a", href=re.compile(r"^https?://")):
            href = link["href"]
            if "bayerischer-golfverband.de" not in href and "bgv" not in href.lower():
                return href
        return None

    def _extract_logo(self, soup: BeautifulSoup) -> str | None:
        # Club logos are usually near the top of the detail page
        for img in soup.find_all("img"):
            src = img.get("src", "")
            alt = img.get("alt", "").lower()
            if "logo" in alt or "logo" in src.lower() or "wappen" in alt:
                if src.startswith("/"):
                    return f"{settings.bgv_base_url}{src}"
                return src
        return None
