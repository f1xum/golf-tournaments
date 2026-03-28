"""Scrape all German golf clubs from german-golf-guide.de.

Iterates all 16 Bundesländer, paginates through listings,
and fetches detail + map pages for full club info.
"""

import re
import html as html_lib
from urllib.parse import unquote

from bs4 import BeautifulSoup

from src.models.club import GolfClub
from src.scrapers.base import BaseScraper

BASE_URL = "https://german-golf-guide.de"

BUNDESLAENDER = [
    "bundesland-baden-wuerttemberg",
    "bundesland-bayern",
    "bundesland-berlin",
    "bundesland-brandenburg",
    "bundesland-bremen",
    "bundesland-hamburg",
    "bundesland-hessen",
    "bundesland-mecklenburg-vorpommern",
    "bundesland-niedersachsen",
    "bundesland-nordrhein-westfalen",
    "bundesland-rheinland-pfalz",
    "bundesland-saarland",
    "bundesland-sachsen",
    "bundesland-sachsen-anhalt",
    "bundesland-schleswig-holstein",
    "bundesland-thueringen",
]

# Map URL slug to display name
BUNDESLAND_NAMES = {
    "bundesland-baden-wuerttemberg": "Baden-Württemberg",
    "bundesland-bayern": "Bayern",
    "bundesland-berlin": "Berlin",
    "bundesland-brandenburg": "Brandenburg",
    "bundesland-bremen": "Bremen",
    "bundesland-hamburg": "Hamburg",
    "bundesland-hessen": "Hessen",
    "bundesland-mecklenburg-vorpommern": "Mecklenburg-Vorpommern",
    "bundesland-niedersachsen": "Niedersachsen",
    "bundesland-nordrhein-westfalen": "Nordrhein-Westfalen",
    "bundesland-rheinland-pfalz": "Rheinland-Pfalz",
    "bundesland-saarland": "Saarland",
    "bundesland-sachsen": "Sachsen",
    "bundesland-sachsen-anhalt": "Sachsen-Anhalt",
    "bundesland-schleswig-holstein": "Schleswig-Holstein",
    "bundesland-thueringen": "Thüringen",
}


class GGGClubsScraper(BaseScraper):
    source_name = "ggg_clubs"

    def run(self) -> None:
        total_scraped = 0
        total_upserted = 0

        for bl_slug in BUNDESLAENDER:
            bl_name = BUNDESLAND_NAMES[bl_slug]
            print(f"\n[GGG] === {bl_name} ===")

            bl_clubs: list[GolfClub] = []
            page = 1
            while True:
                url = f"{BASE_URL}/golfclubs/suche/{bl_slug}/?sort_field=c.title&page={page}"
                print(f"[GGG] Fetching page {page}: {url}")

                try:
                    html = self.fetch(url)
                except Exception as e:
                    print(f"  ✗ Failed to fetch page {page}: {e}")
                    break

                club_slugs = self._parse_listing_page(html)
                if not club_slugs:
                    break

                for slug, listing_info in club_slugs:
                    try:
                        club = self._scrape_club(slug, bl_name, listing_info)
                        if club:
                            bl_clubs.append(club)
                            print(f"  ✓ {club.name} ({club.city})")
                    except Exception as e:
                        print(f"  ✗ Failed: {slug}: {e}")
                        if hasattr(self, "_ctx"):
                            self._ctx.errors.append(f"{slug}: {e}")

                # Check if there's a next page
                max_page = self._get_max_page(html)
                if page >= max_page:
                    break
                page += 1

            # Upsert per Bundesland so progress is saved incrementally
            if bl_clubs:
                seen = set()
                unique = []
                for c in bl_clubs:
                    key = (c.name, c.city)
                    if key not in seen:
                        seen.add(key)
                        unique.append(c)

                rows = [c.to_db_row() for c in unique]
                self.db.upsert_clubs(rows)
                total_scraped += len(bl_clubs)
                total_upserted += len(unique)
                print(f"[GGG] {bl_name}: {len(unique)} clubs saved to DB")

        if hasattr(self, "_ctx"):
            self._ctx.items_found = total_scraped
            self._ctx.items_created = total_upserted

        print(f"\n[GGG] Done. {total_upserted} unique clubs scraped across all states.")

    def _parse_listing_page(self, html: str) -> list[tuple[str, dict]]:
        """Extract club slugs and basic info from listing page."""
        soup = BeautifulSoup(html, "html.parser")
        clubs = []

        rows = soup.select("div.mod > div.row.border-top.py-3")
        if not rows:
            # Try broader selector
            rows = soup.select("div.row.border-top")

        for row in rows:
            # Get club link
            link = row.select_one("h5 a") or row.select_one("a[href]")
            if not link:
                continue

            href = link.get("href", "").strip("/")
            if not href or href.startswith("golfclubs"):
                continue

            slug = href.strip("/")
            name = link.get_text(strip=True)

            # Extract address from <strong> tag
            address_tag = row.select_one("div.col-sm-8 > strong") or row.find("strong")
            address_text = address_tag.get_text(strip=True) if address_tag else ""

            clubs.append((slug, {"name": name, "address_text": address_text}))

        return clubs

    def _get_max_page(self, html: str) -> int:
        """Find the last page number from pagination."""
        soup = BeautifulSoup(html, "html.parser")
        page_links = soup.select("ul.pagination a.page-link")
        max_page = 1
        for link in page_links:
            text = link.get_text(strip=True)
            if text.isdigit():
                max_page = max(max_page, int(text))
        return max_page

    def _scrape_club(self, slug: str, bundesland: str, listing_info: dict) -> GolfClub | None:
        """Fetch detail page and map page for a club."""
        # Detail page
        detail_url = f"{BASE_URL}/{slug}/"
        detail_html = self.fetch(detail_url)
        detail_soup = BeautifulSoup(detail_html, "html.parser")

        # Club name
        h1 = detail_soup.select_one("div.layer h1")
        name = h1.get_text(strip=True) if h1 else listing_info.get("name", slug)

        # DGV number
        dgv_match = re.search(r"\(DGV\s+(\d+)\)", detail_html)
        dgv_number = dgv_match.group(1) if dgv_match else None

        # Address from sidebar
        address, postal_code, city = self._parse_sidebar_address(detail_soup)

        # Fall back to listing address if detail didn't have it
        if not address and listing_info.get("address_text"):
            address, postal_code, city = self._parse_listing_address(listing_info["address_text"])

        # Website
        website = self._extract_website(detail_soup)

        # Email
        email = self._extract_email(detail_soup)

        # Phone
        phone = self._extract_phone(detail_soup)

        # Logo
        logo_url = self._extract_logo(detail_soup)

        # Coordinates from map page
        lat, lng = self._fetch_coordinates(slug)

        return GolfClub(
            name=name,
            address=address,
            city=city,
            postal_code=postal_code,
            region=bundesland,
            latitude=lat,
            longitude=lng,
            website=website,
            phone=phone,
            email=email,
            logo_url=logo_url,
        )

    def _parse_sidebar_address(self, soup: BeautifulSoup) -> tuple[str | None, str | None, str | None]:
        """Extract address from the detail page sidebar."""
        sidebar = soup.select_one("div.col-md-4")
        if not sidebar:
            return None, None, None

        # Look for divs with address content
        text_divs = sidebar.select("div.col.text-start > div")
        if len(text_divs) >= 2:
            street = text_divs[0].get_text(strip=True)
            zip_city = text_divs[1].get_text(strip=True)
            postal_code, city = self._split_zip_city(zip_city)
            return street or None, postal_code, city

        return None, None, None

    def _parse_listing_address(self, text: str) -> tuple[str | None, str | None, str | None]:
        """Parse address from listing format: 'Street - 12345 City'."""
        if " - " in text:
            street, rest = text.split(" - ", 1)
            postal_code, city = self._split_zip_city(rest)
            return street.strip() or None, postal_code, city
        # Try just zip+city
        postal_code, city = self._split_zip_city(text)
        return None, postal_code, city

    def _split_zip_city(self, text: str) -> tuple[str | None, str | None]:
        """Split '12345 City Name' into (postal_code, city)."""
        match = re.match(r"(\d{5})\s+(.+)", text.strip())
        if match:
            return match.group(1), match.group(2).strip()
        return None, text.strip() or None

    def _extract_website(self, soup: BeautifulSoup) -> str | None:
        """Find the club website link."""
        # Look for the explicit "Website des Golfclubs" link
        link = soup.find("a", title=re.compile(r"Website", re.I))
        if link:
            return link.get("href")

        # Fallback: external link in sidebar
        sidebar = soup.select_one("div.col-md-4")
        if sidebar:
            for a in sidebar.find_all("a", href=re.compile(r"^https?://")):
                href = a.get("href", "")
                if "german-golf-guide" not in href:
                    return href
        return None

    def _extract_email(self, soup: BeautifulSoup) -> str | None:
        """Extract email, handling HTML entity encoding."""
        mailto = soup.find("a", href=re.compile(r"^mailto:", re.I))
        if mailto:
            href = mailto.get("href", "")
            # Decode HTML entities and URL encoding
            email = href.replace("mailto:", "")
            email = html_lib.unescape(email)
            email = unquote(email)
            return email.strip() or None
        return None

    def _extract_phone(self, soup: BeautifulSoup) -> str | None:
        """Extract phone number."""
        tel_link = soup.find("a", href=re.compile(r"^tel:"))
        if tel_link:
            return tel_link.get_text(strip=True) or tel_link["href"].replace("tel:", "")

        # Look for phone pattern in Ansprechpartner section
        contact_heading = soup.find("p", class_="text-primary", string=re.compile(r"Ansprechpartner", re.I))
        if contact_heading:
            section = contact_heading.find_parent()
            if section:
                text = section.get_text()
                phone_match = re.search(r"(?:Tel|Fon|Telefon)[.:\s]*([0-9\s\-/()]+)", text, re.I)
                if phone_match:
                    return phone_match.group(1).strip()
        return None

    def _extract_logo(self, soup: BeautifulSoup) -> str | None:
        """Extract club logo URL."""
        img = soup.select_one("div.col.text-end img.img-thumbnail")
        if img:
            src = img.get("src", "")
            if src.startswith("/"):
                return f"{BASE_URL}{src}"
            return src or None

        # Fallback: any logo-like image in sidebar
        sidebar = soup.select_one("div.col-md-4")
        if sidebar:
            for img in sidebar.find_all("img"):
                src = img.get("src", "")
                if src and "logo" in src.lower():
                    if src.startswith("/"):
                        return f"{BASE_URL}{src}"
                    return src
        return None

    def _fetch_coordinates(self, slug: str) -> tuple[float | None, float | None]:
        """Fetch lat/lng from the club's map page."""
        try:
            map_url = f"{BASE_URL}/{slug}/karte/"
            map_html = self.fetch(map_url)
            map_soup = BeautifulSoup(map_html, "html.parser")

            map_div = map_soup.find("div", attrs={"data-service": "maps-golfclub"})
            if map_div:
                data_id = map_div.get("data-id", "")
                ll_match = re.search(r"ll=([-\d.]+),([-\d.]+)", data_id)
                if ll_match:
                    return float(ll_match.group(1)), float(ll_match.group(2))
        except Exception:
            pass
        return None, None
