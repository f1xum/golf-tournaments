from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator


class TournamentSource(StrEnum):
    BGV = "bgv"
    DGV = "dgv"
    CLUB_WEBSITE = "club_website"


class TournamentFormat(StrEnum):
    STROKEPLAY = "strokeplay"
    STABLEFORD = "stableford"
    MATCHPLAY = "matchplay"
    SCRAMBLE = "scramble"
    BEST_BALL = "best_ball"
    CHAPMAN = "chapman"
    TEXAS_SCRAMBLE = "texas_scramble"
    VIERER = "vierer"
    OTHER = "other"


# German → English format mapping
FORMAT_MAPPING: dict[str, TournamentFormat] = {
    "zählspiel": TournamentFormat.STROKEPLAY,
    "zaehlspiel": TournamentFormat.STROKEPLAY,
    "strokeplay": TournamentFormat.STROKEPLAY,
    "stableford": TournamentFormat.STABLEFORD,
    "lochspiel": TournamentFormat.MATCHPLAY,
    "matchplay": TournamentFormat.MATCHPLAY,
    "scramble": TournamentFormat.SCRAMBLE,
    "texas scramble": TournamentFormat.TEXAS_SCRAMBLE,
    "texas-scramble": TournamentFormat.TEXAS_SCRAMBLE,
    "best ball": TournamentFormat.BEST_BALL,
    "bestball": TournamentFormat.BEST_BALL,
    "vierer": TournamentFormat.VIERER,
    "chapman": TournamentFormat.CHAPMAN,
}


class Tournament(BaseModel):
    id: UUID | None = None
    name: str
    club_id: UUID | None = None
    date_start: date
    date_end: date | None = None
    format: TournamentFormat | None = None
    rounds: int | None = None
    max_handicap: float | None = None
    min_handicap: float | None = None
    entry_fee: float | None = None
    entry_fee_currency: str = "EUR"
    age_class: str | None = None
    gender: str | None = None
    description: str | None = None
    registration_url: str | None = None
    source: TournamentSource
    source_url: str | None = None
    raw_data: dict | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("format", mode="before")
    @classmethod
    def normalize_format(cls, v: str | None) -> TournamentFormat | None:
        if v is None:
            return None
        if isinstance(v, TournamentFormat):
            return v
        normalized = FORMAT_MAPPING.get(v.lower().strip())
        return normalized or TournamentFormat.OTHER

    @model_validator(mode="after")
    def default_date_end(self):
        if self.date_end is None:
            self.date_end = self.date_start
        return self

    @field_validator("max_handicap", "min_handicap", "entry_fee", mode="before")
    @classmethod
    def parse_number(cls, v):
        if isinstance(v, str):
            cleaned = v.replace(",", ".").replace("€", "").replace(" ", "")
            try:
                return float(cleaned)
            except ValueError:
                return None
        return v

    def to_db_row(self) -> dict:
        data = self.model_dump(exclude={"id", "created_at", "updated_at"}, exclude_none=True)
        # Serialize enums and dates for JSON
        if "format" in data and data["format"]:
            data["format"] = data["format"].value
        if "source" in data:
            data["source"] = data["source"].value
        if "date_start" in data:
            data["date_start"] = data["date_start"].isoformat()
        if "date_end" in data:
            data["date_end"] = data["date_end"].isoformat()
        if "club_id" in data:
            data["club_id"] = str(data["club_id"])
        return data
