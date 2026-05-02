from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator


class TournamentSource(StrEnum):
    BGV = "bgv"
    DGV = "dgv"
    PCCADDIE = "pccaddie"
    NEXXCHANGE = "nexxchange"
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


# Ordered substring patterns. First match wins, so compound formats
# ("texas scramble") must come before their simpler stems ("scramble").
# Real input is messy: "Einzel - Texas Scramble (Stableford - 2 Spieler)",
# "Vierer / Scramble", "Einzel Zählspiel nach Stableford" — all handled
# by checking for the most specific known format word anywhere in the string.
FORMAT_PATTERNS: list[tuple[str, TournamentFormat]] = [
    ("texas scramble", TournamentFormat.TEXAS_SCRAMBLE),
    ("texas-scramble", TournamentFormat.TEXAS_SCRAMBLE),
    ("chapman", TournamentFormat.CHAPMAN),
    ("best ball", TournamentFormat.BEST_BALL),
    ("best-ball", TournamentFormat.BEST_BALL),
    ("bestball", TournamentFormat.BEST_BALL),
    ("scramble", TournamentFormat.SCRAMBLE),
    ("vierer", TournamentFormat.VIERER),
    ("foursome", TournamentFormat.VIERER),
    ("matchplay", TournamentFormat.MATCHPLAY),
    ("match play", TournamentFormat.MATCHPLAY),
    ("lochspiel", TournamentFormat.MATCHPLAY),
    ("stableford", TournamentFormat.STABLEFORD),
    ("strokeplay", TournamentFormat.STROKEPLAY),
    ("stroke play", TournamentFormat.STROKEPLAY),
    ("zählspiel", TournamentFormat.STROKEPLAY),
    ("zaehlspiel", TournamentFormat.STROKEPLAY),
]


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
        s = v.lower().strip()
        if not s:
            return None
        for pattern, fmt in FORMAT_PATTERNS:
            if pattern in s:
                return fmt
        return TournamentFormat.OTHER

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
