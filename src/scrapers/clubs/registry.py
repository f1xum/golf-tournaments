"""Registry of club-specific scraper configurations.

Each entry maps a club name to a config dict with:
- tournament_url: Direct URL to the club's tournament/events page
"""

# Pilot clubs near Munich with verified tournament page URLs
CLUB_CONFIGS: dict[str, dict] = {
    "Golfclub München Eichenried": {
        "tournament_url": "https://www.pccaddie.net/clubs/0498820/app.php?cat=ts_calendar",
    },
    "OPEN.9 Golf Eichenried": {
        "tournament_url": "https://www.open9.de/buchungen/turnier-buchen-1.html",
    },
    "Golf-Club Feldafing e.V.": {
        "tournament_url": "https://www.golfclub-feldafing.de/turniere/turnierkalender/",
    },
    "Golfclub Starnberg e.V.": {
        "tournament_url": "https://www.gcstarnberg.de/turniere/",
    },
    "Golfclub München-Riem e.V.": {
        "tournament_url": "https://www.gcriem.de/turniere/turnierkalender.html",
    },
    "Golfclub München Valley e.V.": {
        "tournament_url": "https://www.golfvalley.de/sport/turniere.html",
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
