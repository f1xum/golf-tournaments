"""Phase 2 of the course-data pipeline: extract structured course data from
candidate PDFs using Claude's native PDF input.

Reads `course_data_candidates` rows where status='discovered' and asset_type='course_rating',
downloads each PDF, sends it to Claude Sonnet 4.6 with a cached system prompt,
parses the structured JSON response, validates it, and writes the result back
to the candidate row with status='extracted' (or 'failed' on errors).

Costs:
  ~$0.01–0.05 per PDF (depends on page count). Backfill of ~150 clubs ≈ $5.
  Prompt caching cuts ~80% off the system-prompt cost on repeated calls.

Usage:
    python scripts/extract_course_data.py                  # all 'discovered' course_rating candidates
    python scripts/extract_course_data.py --limit 5        # first 5 (smoke test)
    python scripts/extract_course_data.py --candidate <id> # specific candidate
    python scripts/extract_course_data.py --retry-failed   # also retry status='failed'
"""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import anthropic
import httpx

from src.config import settings
from src.database import Database


MODEL = "claude-sonnet-4-6"
MAX_PDF_BYTES = 32 * 1024 * 1024   # Claude PDF input limit is 32 MB
MAX_PDF_PAGES_HINT = 100           # We'd skip giant docs anyway


SYSTEM_PROMPT = """Du extrahierst strukturierte Platzdaten aus offiziellen DGV-Course-Rating-PDFs deutscher Golfclubs.

Antworte AUSSCHLIESSLICH mit gültigem JSON nach diesem Schema (keine Erklärung, kein Markdown):

{
  "tees": [
    {
      "color": "Schwarz | Weiß | Gelb | Blau | Rot | Orange | Grün | … (deutscher Farbname wie im PDF)",
      "gender": "Herren" oder "Damen",
      "course_rating": number,   // CR, z. B. 71.2
      "slope": integer,          // Slope, z. B. 135
      "par": integer,            // i. d. R. 70–72
      "length_m": integer        // Gesamtlänge in Metern
    }
  ],
  "architect": "Name oder null",
  "year_designed": integer | null,
  "course_type": "Parkland | Heath | Links | Mountain | Wiesen-Platz | …" | null,
  "notes": "kurze Bemerkung, falls Daten unsicher oder PDF unklar"
}

Wichtig:
- Übersehe keine Tee-Farben — typische Reihen sind Schwarz/Weiß/Gelb/Blau für Herren und Rot/Blau für Damen, aber Variationen sind möglich.
- Ein Wert pro (color, gender). Falls eine Tee-Farbe für beide Geschlechter bewertet ist, gib zwei Einträge zurück.
- CR ist eine Dezimalzahl (z. B. 71.2), Slope eine Ganzzahl (55–155).
- Erfinde keine Werte. Wenn ein Feld fehlt, lass das ganze Objekt weg oder setze das Feld auf null.
- Wenn das PDF GAR KEINE Course-Rating-Tabelle enthält, gib zurück: {"tees": [], "notes": "kein Course Rating im PDF gefunden"}.
"""

USER_INSTRUCTION = "Extrahiere die Platzdaten aus dem PDF und antworte mit dem JSON-Objekt."


def is_valid_extraction(data: dict) -> tuple[bool, str]:
    """Sanity-check the LLM output. Returns (ok, reason_if_not_ok)."""
    tees = data.get("tees")
    if not isinstance(tees, list) or not tees:
        return False, "no tees array"
    for t in tees:
        try:
            cr = float(t["course_rating"])
            slope = int(t["slope"])
            par = int(t["par"])
            length = int(t["length_m"])
        except (KeyError, TypeError, ValueError):
            return False, f"missing/invalid numeric in tee {t}"
        if not (50 <= cr <= 80):
            return False, f"implausible CR {cr}"
        if not (55 <= slope <= 155):
            return False, f"implausible slope {slope}"
        if not (60 <= par <= 78):
            return False, f"implausible par {par}"
        if not (3000 <= length <= 8500):
            return False, f"implausible length {length}m"
        if t.get("gender") not in ("Herren", "Damen"):
            return False, f"unexpected gender {t.get('gender')}"
    return True, ""


def extract_from_pdf(client: anthropic.Anthropic, pdf_bytes: bytes) -> dict:
    """Send PDF to Claude, return parsed JSON dict. Raises on hard errors."""
    b64 = base64.b64encode(pdf_bytes).decode("ascii")
    msg = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": USER_INSTRUCTION},
                ],
            }
        ],
    )
    text = "".join(
        block.text for block in msg.content if getattr(block, "type", None) == "text"
    ).strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
    return json.loads(text)


def process_candidate(
    http: httpx.Client,
    llm: anthropic.Anthropic,
    db: Database,
    candidate: dict,
) -> str:
    """Process one candidate. Returns final status."""
    cid = candidate["id"]
    asset_url = candidate["asset_url"]

    try:
        time.sleep(settings.request_delay_seconds)
        resp = http.get(asset_url)
        resp.raise_for_status()
        pdf_bytes = resp.content
    except Exception as e:
        notes = f"download failed: {e}"
        print(f"    ✗ {notes}")
        db.client.table("course_data_candidates").update({
            "status": "failed",
            "extraction_notes": notes,
            "extracted_at": "now()",
        }).eq("id", cid).execute()
        return "failed"

    if len(pdf_bytes) > MAX_PDF_BYTES:
        notes = f"pdf too large ({len(pdf_bytes)} bytes)"
        print(f"    ✗ {notes}")
        db.client.table("course_data_candidates").update({
            "status": "failed",
            "extraction_notes": notes,
            "extracted_at": "now()",
        }).eq("id", cid).execute()
        return "failed"

    if not pdf_bytes.startswith(b"%PDF"):
        notes = "asset is not a PDF"
        print(f"    ✗ {notes}")
        db.client.table("course_data_candidates").update({
            "status": "failed",
            "extraction_notes": notes,
            "extracted_at": "now()",
        }).eq("id", cid).execute()
        return "failed"

    try:
        data = extract_from_pdf(llm, pdf_bytes)
    except json.JSONDecodeError as e:
        notes = f"LLM returned non-JSON: {e}"
        print(f"    ✗ {notes}")
        db.client.table("course_data_candidates").update({
            "status": "failed",
            "extraction_notes": notes,
            "extracted_at": "now()",
        }).eq("id", cid).execute()
        return "failed"
    except anthropic.APIError as e:
        notes = f"Anthropic API error: {e}"
        print(f"    ✗ {notes}")
        db.client.table("course_data_candidates").update({
            "status": "failed",
            "extraction_notes": notes,
            "extracted_at": "now()",
        }).eq("id", cid).execute()
        return "failed"

    ok, reason = is_valid_extraction(data)
    if not ok:
        notes = f"validation failed: {reason} (raw: {json.dumps(data)[:300]})"
        print(f"    ⚠ {notes}")
        db.client.table("course_data_candidates").update({
            "status": "failed",
            "extraction_notes": notes,
            "extracted_at": "now()",
            "extracted_data": data,
        }).eq("id", cid).execute()
        return "failed"

    # Reshape into the CourseData JSONB the UI expects.
    course_data = {
        "tees": data["tees"],
        "source_url": asset_url,
    }
    if data.get("architect"):
        course_data["architect"] = data["architect"]
    if data.get("year_designed"):
        course_data["year_designed"] = data["year_designed"]
    if data.get("course_type"):
        course_data["course_type"] = data["course_type"]

    db.client.table("course_data_candidates").update({
        "status": "extracted",
        "extracted_data": course_data,
        "extraction_notes": data.get("notes") or None,
        "extracted_at": "now()",
    }).eq("id", cid).execute()
    print(f"    ✓ {len(course_data['tees'])} tees extracted")
    return "extracted"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--candidate", type=str, default=None, help="Single candidate id")
    parser.add_argument("--retry-failed", action="store_true",
                        help="Also process status='failed' candidates")
    args = parser.parse_args()

    if not settings.anthropic_api_key:
        print("ERROR: ANTHROPIC_API_KEY not set in .env")
        sys.exit(1)
    if not settings.supabase_service_key:
        print(
            "ERROR: SUPABASE_SERVICE_KEY is not set in .env.\n"
            "  This script writes to course_data_candidates, which is RLS-protected.\n"
            "  Add the service_role key from Supabase → project settings → API."
        )
        sys.exit(1)

    db = Database(service_role=True)

    q = db.client.table("course_data_candidates").select(
        "id,club_id,asset_url,asset_type,status"
    ).eq("asset_type", "course_rating")
    if args.candidate:
        q = q.eq("id", args.candidate)
    else:
        if args.retry_failed:
            q = q.in_("status", ["discovered", "failed"])
        else:
            q = q.eq("status", "discovered")
    if args.limit:
        q = q.limit(args.limit)

    candidates = q.execute().data or []
    if not candidates:
        print("No candidates to process.")
        return

    print(f"=== Extracting course data from {len(candidates)} candidate PDF(s) ===\n")

    http = httpx.Client(
        timeout=settings.request_timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 ThePin-CoursePipeline/1.0"},
    )
    llm = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    counts = {"extracted": 0, "failed": 0}
    for i, cand in enumerate(candidates, 1):
        print(f"[{i}/{len(candidates)}] {cand['asset_url']}")
        try:
            status = process_candidate(http, llm, db, cand)
            counts[status] = counts.get(status, 0) + 1
        except Exception as e:
            print(f"    ! unexpected error: {e}")
            counts["failed"] += 1

    http.close()
    print(f"\n=== Done. Extracted: {counts['extracted']}, Failed: {counts['failed']} ===")
    print("Next: open /admin/course-data to review and approve.")


if __name__ == "__main__":
    main()
