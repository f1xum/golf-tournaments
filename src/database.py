import time
from datetime import datetime, timezone

from supabase import Client, create_client

from src.config import settings
from src.models.scrape_log import ScrapeLog, ScrapeStatus


def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_key)


class Database:
    def __init__(self, client: Client | None = None):
        self.client = client or get_supabase_client()

    # ── Clubs ──────────────────────────────────────────

    def upsert_club(self, club_data: dict) -> dict:
        """Upsert a club by (name, city). Returns the row."""
        result = (
            self.client.table("golf_clubs")
            .upsert(club_data, on_conflict="name,city")
            .execute()
        )
        return result.data[0] if result.data else {}

    def upsert_clubs(self, clubs: list[dict]) -> list[dict]:
        """Batch upsert clubs."""
        result = (
            self.client.table("golf_clubs")
            .upsert(clubs, on_conflict="name,city")
            .execute()
        )
        return result.data

    def get_all_clubs(self) -> list[dict]:
        result = self.client.table("golf_clubs").select("*").execute()
        return result.data

    def get_clubs_without_coordinates(self) -> list[dict]:
        result = (
            self.client.table("golf_clubs")
            .select("*")
            .is_("latitude", "null")
            .execute()
        )
        return result.data

    def update_club_coordinates(self, club_id: str, lat: float, lng: float) -> None:
        self.client.table("golf_clubs").update(
            {"latitude": lat, "longitude": lng}
        ).eq("id", club_id).execute()

    def find_club_by_name(self, name: str) -> dict | None:
        """Fuzzy match club by name (case-insensitive contains)."""
        result = (
            self.client.table("golf_clubs")
            .select("*")
            .ilike("name", f"%{name}%")
            .execute()
        )
        return result.data[0] if result.data else None

    # ── Tournaments ────────────────────────────────────

    def upsert_tournament(self, tournament_data: dict) -> dict:
        result = (
            self.client.table("tournaments")
            .upsert(tournament_data, on_conflict="name,date_start,club_id,source")
            .execute()
        )
        return result.data[0] if result.data else {}

    def upsert_tournaments(self, tournaments: list[dict]) -> list[dict]:
        result = (
            self.client.table("tournaments")
            .upsert(tournaments, on_conflict="name,date_start,club_id,source")
            .execute()
        )
        return result.data

    def get_tournaments(
        self,
        source: str | None = None,
        club_id: str | None = None,
        from_date: str | None = None,
    ) -> list[dict]:
        query = self.client.table("tournaments").select("*")
        if source:
            query = query.eq("source", source)
        if club_id:
            query = query.eq("club_id", club_id)
        if from_date:
            query = query.gte("date_start", from_date)
        return query.order("date_start").execute().data

    # ── Scrape Logs ────────────────────────────────────

    def start_scrape_log(self, source: str) -> str:
        """Create a new scrape log entry. Returns the log ID."""
        log = ScrapeLog(
            source=source,
            status=ScrapeStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        result = (
            self.client.table("scrape_logs").insert(log.to_db_row()).execute()
        )
        return result.data[0]["id"]

    def finish_scrape_log(
        self,
        log_id: str,
        status: ScrapeStatus,
        items_found: int = 0,
        items_created: int = 0,
        items_updated: int = 0,
        errors: list[str] | None = None,
        started_at: datetime | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        update_data: dict = {
            "status": status.value,
            "items_found": items_found,
            "items_created": items_created,
            "items_updated": items_updated,
            "finished_at": now.isoformat(),
        }
        if errors:
            update_data["errors"] = errors
        if started_at:
            update_data["duration_seconds"] = (now - started_at).total_seconds()
        self.client.table("scrape_logs").update(update_data).eq("id", log_id).execute()


class ScrapeContext:
    """Context manager that auto-logs scraping runs."""

    def __init__(self, db: Database, source: str):
        self.db = db
        self.source = source
        self.log_id: str = ""
        self.items_found = 0
        self.items_created = 0
        self.items_updated = 0
        self.errors: list[str] = []
        self.started_at: datetime | None = None

    def __enter__(self):
        self.log_id = self.db.start_scrape_log(self.source)
        self.started_at = datetime.now(timezone.utc)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.errors.append(f"{exc_type.__name__}: {exc_val}")
            status = ScrapeStatus.FAILED
        elif self.errors:
            status = ScrapeStatus.PARTIAL
        else:
            status = ScrapeStatus.SUCCESS

        self.db.finish_scrape_log(
            self.log_id,
            status=status,
            items_found=self.items_found,
            items_created=self.items_created,
            items_updated=self.items_updated,
            errors=self.errors if self.errors else None,
            started_at=self.started_at,
        )
        return False  # Don't suppress exceptions
