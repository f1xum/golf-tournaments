"""Batch geocode club addresses using Nominatim (free, no API key needed)."""

import time

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

from src.config import settings
from src.database import Database


def geocode_clubs(db: Database | None = None) -> None:
    """Geocode all clubs that don't have coordinates yet."""
    db = db or Database()
    geolocator = Nominatim(user_agent=settings.nominatim_user_agent, timeout=10)

    clubs = db.get_clubs_without_coordinates()
    print(f"[Geocoder] {len(clubs)} clubs need geocoding.")

    success = 0
    failed = 0

    for club in clubs:
        query = _build_query(club)
        if not query:
            print(f"  ⚠ No address for {club['name']}, skipping")
            failed += 1
            continue

        try:
            time.sleep(1.1)  # Nominatim rate limit: 1 req/sec
            location = geolocator.geocode(query, country_codes="de")

            if location:
                db.update_club_coordinates(club["id"], location.latitude, location.longitude)
                print(f"  ✓ {club['name']}: {location.latitude:.4f}, {location.longitude:.4f}")
                success += 1
            else:
                # Retry with just city + "Golf" as fallback
                fallback_query = f"Golf {club.get('city', '')}, Bayern, Deutschland"
                time.sleep(1.1)
                location = geolocator.geocode(fallback_query, country_codes="de")
                if location:
                    db.update_club_coordinates(
                        club["id"], location.latitude, location.longitude
                    )
                    print(
                        f"  ✓ {club['name']} (fallback): "
                        f"{location.latitude:.4f}, {location.longitude:.4f}"
                    )
                    success += 1
                else:
                    print(f"  ✗ {club['name']}: not found for '{query}'")
                    failed += 1

        except (GeocoderTimedOut, GeocoderServiceError) as e:
            print(f"  ✗ {club['name']}: geocoder error: {e}")
            failed += 1

    print(f"\n[Geocoder] Done. {success} geocoded, {failed} failed.")


def _build_query(club: dict) -> str | None:
    """Build a geocoding query from club data."""
    parts = []
    if club.get("address"):
        parts.append(club["address"])
    if club.get("postal_code"):
        parts.append(club["postal_code"])
    if club.get("city"):
        parts.append(club["city"])

    if not parts:
        return None

    parts.append("Bayern, Deutschland")
    return ", ".join(parts)
