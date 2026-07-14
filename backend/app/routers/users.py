"""Admin user directory: list with filters, detail with location history, and
update (reassign designation / deactivate, with device-reuse detection)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status

from .. import repository as repo
from ..deps import require_admin
from ..models import AuditAction, UserFlag, category_for
from ..schemas import UserPatch, UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(
    designation: str | None = None,
    category: str | None = None,
    presence: str | None = Query(None, alias="status", description="online | offline"),
    q: str | None = None,
    page: int = 1,
    page_size: int = Query(50, alias="pageSize", ge=1, le=200),
    admin: dict = Depends(require_admin),
) -> dict:
    online = None
    if presence:
        p = presence.lower()
        if p == "online":
            online = True
        elif p == "offline":
            online = False

    items, total = await repo.list_users(
        designation=designation,
        category=category,
        online=online,
        q=q,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [UserPublic.from_doc(u) for u in items],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


@router.get("/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(require_admin)) -> dict:
    user = await repo.get_user(user_id)
    if user is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="User not found")
    history = await repo.list_pings_for_user(user_id, limit=100)
    return {
        "user": UserPublic.from_doc(user),
        "registration": {
            "deviceId": user.get("deviceId"),
            "deviceName": user.get("deviceName") or "",
            "appVersion": user.get("appVersion"),
            "initialLocation": user.get("initialLocation"),
            "createdAt": user.get("createdAt"),
        },
        "locationHistory": [
            {"lat": p["lat"], "lng": p["lng"], "at": p["at"]} for p in history
        ],
    }


@router.patch("/{user_id}")
async def update_user(
    user_id: str, body: UserPatch, admin: dict = Depends(require_admin)
) -> UserPublic:
    user = await repo.get_user(user_id)
    if user is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="User not found")

    changes: dict = {}
    if body.designation is not None:
        changes["designation"] = body.designation.value
        changes["category"] = category_for(body.designation).value
    if body.status is not None:
        changes["status"] = body.status.value

    flagged = False
    if body.deviceId and body.deviceId != user.get("deviceId"):
        changes["deviceId"] = body.deviceId
        others = [
            u
            for u in await repo.find_active_users_by_device(body.deviceId)
            if u["_id"] != user_id
        ]
        if others:
            await repo.add_user_flag(
                user_id,
                UserFlag(
                    type="device_reused",
                    detail=f"deviceId {body.deviceId} already active on {others[0]['fullName']}",
                ).model_dump(),
            )
            flagged = True

    if changes:
        await repo.update_user(user_id, changes)

    await repo.write_audit(
        action=AuditAction.UPDATE,
        entity_type="user",
        entity_id=user_id,
        actor_label=admin["fullName"],
        actor_id=admin["_id"],
        payload={"changes": changes},
    )
    if flagged:
        await repo.write_audit(
            action=AuditAction.FLAG,
            entity_type="user",
            entity_id=user_id,
            actor_label=admin["fullName"],
            actor_id=admin["_id"],
            payload={"type": "device_reused", "deviceId": body.deviceId},
        )

    updated = await repo.get_user(user_id)
    return UserPublic.from_doc(updated)
