"""Registry of club-specific scraper configurations.

Each entry maps a club name to a config dict with:
- tournament_url: Direct URL to the club's tournament/events page
"""

# Pilot clubs near Munich with verified tournament page URLs
CLUB_CONFIGS: dict[str, dict] = {
    # Clubs covered by PC CADDIE scraper (removed to avoid duplicates):
    # - Golfclub München Eichenried, Golf-Club Feldafing, Golfclub Starnberg,
    #   Golfclub München-Riem, Golf Valley (München Valley)
    "OPEN.9 Golf Eichenried": {
        "tournament_url": "https://www.open9.de/buchungen/turnier-buchen-1.html",
    },
    "Golfclub Olching e.V.": {
        "tournament_url": "https://www.golfclubolching.de/sport/turniere.html",
    },
}


def get_club_config(club_name: str) -> dict | None:
    """Get scraper config for a club by name (fuzzy match)."""
    if club_name in CLUB_CONFIGS:
        return CLUB_CONFIGS[club_name]

    name_lower = club_name.lower()
    for key, config in CLUB_CONFIGS.items():
        if name_lower in key.lower() or key.lower() in name_lower:
            return config

    return None


def get_all_configured_clubs() -> dict[str, dict]:
    return CLUB_CONFIGS.copy()
