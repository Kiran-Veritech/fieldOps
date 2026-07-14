"""Presence: employees push a location ping (every 10s while foregrounded),
and /me returns the profile with a live-derived online/offline field."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from .. import repository as repo
from ..deps import get_current_user
from ..schemas import PingRequest, PingResponse, UserPublic

router = APIRouter(tags=["presence"])


@router.post("/pings", response_model=PingResponse)
async def create_ping(
    body: PingRequest, user: dict = Depends(get_current_user)
) -> PingResponse:
    now = datetime.now(timezone.utc)
    ping = await repo.record_ping(user["_id"], body.lat, body.lng, at=now)
    # Just pinged, so presence is necessarily online right now.
    return PingResponse(recorded=True, at=ping["at"], online=True)


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)) -> UserPublic:
    # `user` is re-fetched fresh on every request by get_current_user, so
    # lastPingAt is current; online is derived here, never stored.
    return UserPublic.from_doc(user)
