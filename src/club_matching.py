"""Shared club name matching utilities.

Used by scrapers (BGV, DGV) and the backfill script to match
venue names to golf_clubs rows.
"""

import re


# Common abbreviations used in tournament venue names
_ABBREVIATIONS = {
    r'\bga\b': 'gc',       # Golfanlage
    r'\bgp\b': 'gc',       # Golfplatz
    r'\bgr\b': 'gc',       # Golf Resort
    r'\bgc\b': 'gc',       # Golf Club
    r'\bglc\b': 'gc',      # Golf- und Landclub
    r'\bgcc\b': 'gc',      # Golf & Country Club
}


def normalize_club_name(name: str) -> str:
    """Normalize a club/venue name for fuzzy matching."""
    s = name.lower().strip()
    # Remove legal suffixes
    s = re.sub(r'\s+e\.?\s*v\.?', '', s)
    s = re.sub(r'\s+gmbh(\s*&\s*co\.?\s*kg)?', '', s)
    s = re.sub(r'\s+ag\b', '', s)
    # Normalize full club prefixes to 'gc'
    s = re.sub(r'\bgolf[\s-]*(club|verein|anlage|park|resort|platz)\b', 'gc', s)
    s = re.sub(r'\bgolfclub\b', 'gc', s)
    s = re.sub(r'\bgolf\s*&\s*country\s*club\b', 'gc', s)
    s = re.sub(r'\bgolf[\s-]*und[\s-]*landclub\b', 'gc', s)
    s = re.sub(r'\bgolf[\s-]*und[\s-]*country[\s-]*club\b', 'gc', s)
    # Normalize abbreviations (GA, GP, GR, GC, GLC, GCC)
    for pattern, replacement in _ABBREVIATIONS.items():
        s = re.sub(pattern, replacement, s)
    # Remove common noise words
    s = re.sub(r'\b(der|die|das|und|and|am|im|an|zu|bei|von)\b', '', s)
    # Remove punctuation
    s = re.sub(r'[^\w\s]', '', s)
    # Collapse whitespace
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def build_club_index(clubs: list[dict]) -> dict[str, dict]:
    """Build a normalized name → club lookup from a list of club dicts.
    Also indexes by city for better matching."""
    index: dict[str, dict] = {}
    for club in clubs:
        norm = normalize_club_name(club["name"])
        if norm not in index:
            index[norm] = club
        # Also index without the 'gc' prefix for short-name matching
        # e.g. "gc holledau" → also index "holledau"
        short = re.sub(r'^gc\s+', '', norm)
        if short != norm and len(short) >= 4 and short not in index:
            index[short] = club
    return index


def match_club_name(
    venue: str,
    club_index: dict[str, dict],
    clubs_by_name: dict[str, dict] | None = None,
) -> dict | None:
    """Try to match a venue name to a club.

    Args:
        venue: The venue/club name to match.
        club_index: Normalized name → club dict (from build_club_index).
        clubs_by_name: Optional original name → club dict for exact matches.

    Returns:
        The matched club dict, or None.
    """
    if not venue or venue == "verschiedene Austragungsorte":
        return None

    # Direct match on original name
    if clubs_by_name and venue in clubs_by_name:
        return clubs_by_name[venue]

    venue_norm = normalize_club_name(venue)

    # Exact normalized match
    if venue_norm in club_index:
        return club_index[venue_norm]

    # Also try without 'gc' prefix
    venue_short = re.sub(r'^gc\s+', '', venue_norm)
    if venue_short != venue_norm and venue_short in club_index:
        return club_index[venue_short]

    # Substring match: venue contained in club name or vice versa
    for norm_name, club in club_index.items():
        if len(venue_norm) >= 4 and len(norm_name) >= 4:
            if venue_norm in norm_name or norm_name in venue_norm:
                return club

    return None
