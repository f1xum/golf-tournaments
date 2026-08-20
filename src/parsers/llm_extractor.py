"""Use Claude API to extract structured tournament data from unstructured text/HTML."""

import json
import re

import anthropic

from src.config import settings

EXTRACTION_PROMPT = """You are a data extraction assistant. Extract golf tournament information from the following text/HTML.

Return a JSON array of tournament objects. Each object should have these fields (use null if not found):
- name: Tournament name (string)
- date_start: Start date in YYYY-MM-DD format (string)
- date_end: End date in YYYY-MM-DD format, same as start if single day (string)
- format: One of: strokeplay, stableford, matchplay, scramble, texas_scramble, best_ball, chapman, vierer, other (string)
- rounds: Number of rounds (integer)
- max_handicap: Maximum handicap allowed (number)
- entry_fee: Entry fee in EUR (number)
- age_class: Age class if specified (string)
- description: Brief description (string)
- registration_url: Registration URL if found (string)

Important:
- Parse German dates (DD.MM.YYYY) to YYYY-MM-DD format
- Translate German golf terms: Zählspiel=strokeplay, Stableford=stableford, Lochspiel=matchplay, Scramble=scramble
- Entry fees: convert "30,- €" or "30 Euro" to 30
- Only include actual tournaments, not course info or general club details

Return ONLY the JSON array, no other text.

Text to extract from:
{text}"""


def extract_tournaments_with_llm(text: str) -> list[dict]:
    """Send text to Claude API and get structured tournament data back."""
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Truncate very long text to stay within context limits
    if len(text) > 50000:
        text = text[:50000]

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[
            {"role": "user", "content": EXTRACTION_PROMPT.format(text=text)},
        ],
    )

    response_text = message.content[0].text.strip()

    # Handle markdown code blocks in response
    if response_text.startswith("```"):
        response_text = response_text.split("\n", 1)[1]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

    try:
        data = json.loads(response_text)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        print(f"  ⚠ LLM returned invalid JSON: {response_text[:200]}")
        return []


MONTH_PAGE_PROMPT = """Jede Zeile unten ist ein bereits aufgelöstes Datum aus einem
deutschen Golf-Turnierkalender, gefolgt vom Text dieser Kalenderzeile.

Gib für JEDE Zeile, die ein echtes Turnier beschreibt, ein JSON-Objekt zurück:
  "name"        Turniername, ohne Platzkürzel, Startzeit oder Fußnotenzeichen
  "date_start"  exakt das Datum am Zeilenanfang, unverändert übernehmen
  "format"      einer von: strokeplay, stableford, matchplay, scramble,
                texas_scramble, chapman, vierer, best_ball, other
  "description" Startzeit, Platz und Hinweise, sonst null

Regeln:
- Das Datum NIEMALS verändern, verschieben oder erraten.
- Nur echte Turniere. Keine Kurse, Ferien, Platzsperren, Sitzungen, Öffnungszeiten.
- Enthält eine Zeile mehrere Turniere, gib mehrere Objekte mit demselben Datum zurück.

Antworte NUR mit einem JSON-Array, ohne Erklärung.

ZEILEN:
{text}"""


def extract_month_page_with_llm(dated_lines: str) -> list[dict]:
    """Name and classify tournaments from already-dated calendar lines.

    Dates are resolved from the PDF's own layout before this is called (see
    src/parsers/pdf_calendar.py) and passed in on each line. The model never
    computes a date — an earlier version let it infer dates from raw page text
    and it placed tournaments up to five days off.
    """
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": MONTH_PAGE_PROMPT.format(text=dated_lines[:50000]),
        }],
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        response_text = response_text.split("\n", 1)[1]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []
