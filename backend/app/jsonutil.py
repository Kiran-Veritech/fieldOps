"""JSON datetime helpers — Mongo stores naive UTC; browsers must see a Z/offset."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any


def utc_iso(dt: datetime) -> str:
    """Serialize datetimes as UTC ISO-8601 with a Z suffix."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def install_utc_json_encoders() -> None:
    """Make FastAPI's jsonable_encoder emit Z-suffixed UTC for all datetimes."""
    from fastapi.encoders import ENCODERS_BY_TYPE

    ENCODERS_BY_TYPE[datetime] = utc_iso
    ENCODERS_BY_TYPE[date] = lambda d: d.isoformat()


def parse_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return None
