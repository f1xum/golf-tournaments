from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel


class ScrapeStatus(StrEnum):
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class ScrapeLog(BaseModel):
    id: UUID | None = None
    source: str
    status: ScrapeStatus
    items_found: int = 0
    items_created: int = 0
    items_updated: int = 0
    errors: list[str] | None = None
    duration_seconds: float | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None

    def to_db_row(self) -> dict:
        data = self.model_dump(exclude={"id"}, exclude_none=True)
        if "status" in data:
            data["status"] = data["status"].value
        if "started_at" in data:
            data["started_at"] = data["started_at"].isoformat()
        if "finished_at" in data:
            data["finished_at"] = data["finished_at"].isoformat()
        return data
