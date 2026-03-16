"""Geocode all clubs that don't have coordinates yet."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.normalization.geocoder import geocode_clubs


def main():
    print("=== Geocoding Golf Clubs ===\n")
    geocode_clubs()


if __name__ == "__main__":
    main()
