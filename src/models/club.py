from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class GolfClub(BaseModel):
    id: UUID | None = None
    name: str
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    region: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    website: str | None = None
    bgv_url: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    cms_type: str | None = None
    has_public_tournaments: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("website", "bgv_url", mode="before")
    @classmethod
    def normalize_url(cls, v: str | None) -> str | None:
        if v and not v.startswith(("http://", "https://")):
            return f"https://{v}"
        return v

    @field_validator("postal_code", mode="before")
    @classmethod
    def normalize_postal_code(cls, v: str | None) -> str | None:
        if v:
            return v.strip().zfill(5)
        return v

    def to_db_row(self) -> dict:
        data = self.model_dump(exclude={"id", "created_at", "updated_at"}, exclude_none=True)
        return data
