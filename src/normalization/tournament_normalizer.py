"""Normalize German tournament terms to standardized enums."""

import re

# Age class normalization
AGE_CLASS_MAP = {
    "erwachsene": "adults",
    "jugend": "youth",
    "senioren": "seniors",
    "seniorinnen": "seniors_female",
    "ak 14": "u14",
    "ak 16": "u16",
    "ak 18": "u18",
    "ak 30": "30+",
    "ak 50": "50+",
    "ak 65": "65+",
}

# Gender normalization
GENDER_MAP = {
    "damen": "female",
    "herren": "male",
    "mixed": "mixed",
    "offen": "open",
    "mannschaft": "team",
    "einzel": "individual",
}


def normalize_age_class(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.lower().strip()
    return AGE_CLASS_MAP.get(key, raw)


def normalize_gender(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.lower().strip()
    return GENDER_MAP.get(key, raw)


def normalize_entry_fee(raw: str | None) -> float | None:
    """Parse German fee strings like '30,- €', '€ 45.00', '30 Euro'."""
    if not raw:
        return None
    cleaned = raw.replace("€", "").replace("Euro", "").replace("EUR", "")
    cleaned = cleaned.replace(",- ", "").replace(",-", "").strip()
    cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None
