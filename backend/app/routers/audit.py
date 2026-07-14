"""Admin audit log: filterable, append-only trail of state changes."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from .. import repository as repo
from ..deps import require_admin

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
async def list_audit(
    actor: str | None = Query(None, description="actorId"),
    action: str | None = None,
    entityType: str | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    q: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    admin: dict = Depends(require_admin),
) -> list[dict]:
    return await repo.list_audit(
        actor_id=actor,
        action=action,
        entity_type=entityType,
        date_from=date_from,
        date_to=date_to,
        q=q,
        limit=limit,
    )
