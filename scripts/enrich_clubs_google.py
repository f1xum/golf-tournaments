"""Enrich golf club data using Google Maps Places API.

For each club, searches Google Maps by name + "Deutschland" and extracts:
- website, phone, address, postal_code, city, latitude, longitude

Requires GOOGLE_MAPS_API_KEY in .env with Places API enabled.
Cost: ~$0.017 per Place Details request (~$3.40 for 200 clubs).
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx

from src.config import settings
from src.database import Database


FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def find_place_id(client: httpx.Client, name: str, api_key: str) -> str | None:
    """Find the Google Place ID for a golf club by name."""
    resp = client.get(FIND_PLACE_URL, params={
        "input": f"{name} Golf Deutschland",
        "inputtype": "textquery",
        "fields": "place_id",
        "locationbias": "circle:500000@51.1657,10.4515",  # 500km around center of Germany
        "key": api_key,
    })
    data = resp.json()
    candidates = data.get("candidates", [])
    return candidates[0]["place_id"] if candidates else None


def get_place_details(client: httpx.Client, place_id: str, api_key: str) -> dict:
    """Get detailed info for a Google Place."""
    resp = client.get(PLACE_DETAILS_URL, params={
        "place_id": place_id,
        "fields": "formatted_address,formatted_phone_number,international_phone_number,website,geometry,address_components",
        "language": "de",
        "key": api_key,
    })
    data = resp.json()
    return data.get("result", {})


def extract_club_info(details: dict) -> dict:
    """Extract structured club info from Google Places result."""
    info = {}

    if details.get("website"):
        info["website"] = details["website"]

    if details.get("international_phone_number"):
        info["phone"] = details["international_phone_number"]
    elif details.get("formatted_phone_number"):
        info["phone"] = details["formatted_phone_number"]

    # Extract address components
    components = details.get("address_components", [])
    street_number = ""
    route = ""
    for comp in components:
        types = comp.get("types", [])
        if "street_number" in types:
            street_number = comp["long_name"]
        elif "route" in types:
            route = comp["long_name"]
        elif "locality" in types:
            info["city"] = comp["long_name"]
        elif "postal_code" in types:
            info["postal_code"] = comp["long_name"].zfill(5)

    if route:
        info["address"] = f"{route} {street_number}".strip()

    # Coordinates
    geo = details.get("geometry", {}).get("location", {})
    if geo.get("lat") and geo.get("lng"):
        info["latitude"] = geo["lat"]
        info["longitude"] = geo["lng"]

    return info


def main():
    api_key = settings.google_maps_api_key
    if not api_key:
        print("ERROR: GOOGLE_MAPS_API_KEY not set in .env")
        sys.exit(1)

    db = Database()
    clubs = db.get_all_clubs()
    print(f"=== Enriching {len(clubs)} clubs from Google Maps ===\n")

    client = httpx.Client(timeout=15)
    updated = 0
    skipped = 0
    not_found = 0

    for club in clubs:
        name = club["name"]
        club_id = club["id"]

        # Always process clubs — website should always be refreshed
        # Check which fields are missing (for logging)
        missing_fields = []
        for field in ["phone", "address", "postal_code", "city"]:
            if not club.get(field) or club[field].strip() == "":
                missing_fields.append(field)
        if not club.get("latitude") or not club.get("longitude"):
            missing_fields.append("coordinates")
        missing_fields.append("website (refresh)")

        print(f"[Google] {name} — missing: {', '.join(missing_fields)}")

        # Find place
        place_id = find_place_id(client, name, api_key)
        if not place_id:
            print(f"  ✗ Not found on Google Maps")
            not_found += 1
            time.sleep(0.2)
            continue

        # Get details
        details = get_place_details(client, place_id, api_key)
        info = extract_club_info(details)

        if not info:
            print(f"  ✗ No useful details returned")
            not_found += 1
            time.sleep(0.2)
            continue

        # Always overwrite website; only fill missing for other fields
        always_overwrite = {"website"}
        updates = {}
        for key, val in info.items():
            if key == "latitude" and club.get("latitude"):
                continue
            if key == "longitude" and club.get("longitude"):
                continue
            if key in ("latitude", "longitude"):
                updates[key] = val
                continue
            if key in always_overwrite or not club.get(key) or club[key].strip() == "":
                updates[key] = val

        if updates:
            updates["updated_at"] = "now()"
            db.client.table("golf_clubs").update(updates).eq("id", club_id).execute()
            updated += 1
            print(f"  ✓ Updated: {', '.join(k for k in updates if k != 'updated_at')}")
        else:
            print(f"  – Nothing new to update")
            skipped += 1

        time.sleep(0.2)  # Gentle rate limit

    client.close()
    print(f"\n=== Done. Updated: {updated}, Skipped: {skipped}, Not found: {not_found} ===")


if __name__ == "__main__":
    main()
