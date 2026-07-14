"""Motor data-access functions for the FieldOps Nexus collections.

Thin async helpers over the raw collections. Reads return plain dicts (with the
string `_id`); writes accept Pydantic models or primitive fields. Presence
(online/offline) is always DERIVED here, never stored.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .db import get_db
from .models import (
    PRESENCE_WINDOW_SECONDS,
    Asset,
    AssetStatus,
    AuditAction,
    AuditLog,
    GeoPoint,
    Ping,
    Project,
    StatusHistoryEntry,
    Task,
    TaskStatus,
    User,
)


# ---------------------------------------------------------------------------
# Presence (derived)
# ---------------------------------------------------------------------------


def is_online(last_ping_at: datetime | None, now: datetime | None = None) -> bool:
    """A user is ONLINE if their last ping was within PRESENCE_WINDOW_SECONDS."""
    if last_ping_at is None:
        return False
    now = now or datetime.now(timezone.utc)
    if last_ping_at.tzinfo is None:
        # Mongo hands back naive UTC datetimes.
        last_ping_at = last_ping_at.replace(tzinfo=timezone.utc)
    return (now - last_ping_at).total_seconds() <= PRESENCE_WINDOW_SECONDS


def with_presence(user: dict, now: datetime | None = None) -> dict:
    """Return a copy of a user doc with a derived `online` boolean attached."""
    return {**user, "online": is_online(user.get("lastPingAt"), now)}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


async def create_user(user: User) -> dict:
    doc = user.model_dump(by_alias=True)
    await get_db().users.insert_one(doc)
    return doc


async def get_user(user_id: str) -> dict | None:
    return await get_db().users.find_one({"_id": user_id})


async def get_user_by_email(work_email: str) -> dict | None:
    return await get_db().users.find_one({"workEmail": work_email.lower()})


async def list_users(
    *,
    designation: str | None = None,
    category: str | None = None,
    online: bool | None = None,
    status: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict], int]:
    """List users with filters. The online/offline filter is applied in-memory
    because presence is derived, not stored."""
    query: dict = {}
    if designation:
        query["designation"] = designation
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"fullName": {"$regex": q, "$options": "i"}},
            {"workEmail": {"$regex": q, "$options": "i"}},
        ]

    cursor = get_db().users.find(query).sort("fullName", 1)
    docs = [with_presence(d) async for d in cursor]

    if online is not None:
        docs = [d for d in docs if d["online"] is online]

    total = len(docs)
    start = max(page - 1, 0) * page_size
    return docs[start : start + page_size], total


async def update_user(user_id: str, changes: dict) -> dict | None:
    await get_db().users.update_one({"_id": user_id}, {"$set": changes})
    return await get_user(user_id)


async def add_user_flag(user_id: str, flag: dict) -> None:
    await get_db().users.update_one({"_id": user_id}, {"$push": {"flags": flag}})


async def find_active_users_by_device(device_id: str) -> list[dict]:
    cursor = get_db().users.find({"deviceId": device_id, "status": "active"})
    return [d async for d in cursor]


# ---------------------------------------------------------------------------
# Pings
# ---------------------------------------------------------------------------


async def record_ping(user_id: str, lat: float, lng: float, at: datetime | None = None) -> dict:
    """Insert a ping and update the owner's lastPingAt + lastLocation."""
    ping = Ping(userId=user_id, lat=lat, lng=lng, at=at or datetime.now(timezone.utc))
    doc = ping.model_dump(by_alias=True)
    db = get_db()
    await db.pings.insert_one(doc)
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"lastPingAt": doc["at"], "lastLocation": GeoPoint(lat=lat, lng=lng).model_dump()}},
    )
    return doc


async def list_recent_pings(limit: int = 25) -> list[dict]:
    cursor = get_db().pings.find().sort("at", -1).limit(limit)
    return [d async for d in cursor]


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


async def create_project(project: Project) -> dict:
    doc = project.model_dump(by_alias=True)
    await get_db().projects.insert_one(doc)
    return doc


async def get_project(project_id: str) -> dict | None:
    return await get_db().projects.find_one({"_id": project_id})


async def list_projects(*, status: str | None = None) -> list[dict]:
    query: dict = {}
    if status:
        query["status"] = status
    cursor = get_db().projects.find(query).sort("createdAt", -1)
    return [d async for d in cursor]


async def list_projects_for_member(user_id: str) -> list[dict]:
    """Projects the given user is a member of (used by the field app)."""
    cursor = get_db().projects.find({"memberIds": user_id}).sort("createdAt", -1)
    return [d async for d in cursor]


async def add_project_members(project_id: str, user_ids: list[str]) -> dict | None:
    await get_db().projects.update_one(
        {"_id": project_id}, {"$addToSet": {"memberIds": {"$each": user_ids}}}
    )
    return await get_project(project_id)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


async def create_task(task: Task) -> dict:
    doc = task.model_dump(by_alias=True)
    await get_db().tasks.insert_one(doc)
    return doc


async def commit_tasks(tasks: list[Task]) -> list[dict]:
    """Persist a batch of reviewed tasks (used by the AI review → commit flow)."""
    docs = [t.model_dump(by_alias=True) for t in tasks]
    if docs:
        await get_db().tasks.insert_many(docs)
    return docs


async def list_tasks(
    *, project_id: str | None = None, assignee_id: str | None = None, status: str | None = None
) -> list[dict]:
    query: dict = {}
    if project_id:
        query["projectId"] = project_id
    if assignee_id:
        query["assigneeId"] = assignee_id
    if status:
        query["status"] = status
    cursor = get_db().tasks.find(query).sort("createdAt", -1)
    return [d async for d in cursor]


async def update_task_status(
    task_id: str,
    new_status: TaskStatus,
    *,
    blocked_reason: str | None = None,
    by_user_id: str | None = None,
) -> dict | None:
    """Move a task to a new status. BLOCKED requires a reason (enforced here)."""
    status_value = new_status.value if isinstance(new_status, TaskStatus) else new_status
    if status_value == TaskStatus.BLOCKED.value and not blocked_reason:
        raise ValueError("blockedReason is required when moving a task to BLOCKED")

    now = datetime.now(timezone.utc)
    history = StatusHistoryEntry(
        status=new_status, at=now, byUserId=by_user_id, reason=blocked_reason
    ).model_dump()

    changes = {
        "status": status_value,
        "updatedAt": now,
        "blockedReason": blocked_reason if status_value == TaskStatus.BLOCKED.value else None,
    }
    await get_db().tasks.update_one(
        {"_id": task_id}, {"$set": changes, "$push": {"statusHistory": history}}
    )
    return await get_db().tasks.find_one({"_id": task_id})


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------


async def create_asset(asset: Asset) -> dict:
    doc = asset.model_dump(by_alias=True)
    await get_db().assets.insert_one(doc)
    return doc


async def get_asset(asset_id: str) -> dict | None:
    return await get_db().assets.find_one({"_id": asset_id})


async def list_assets(*, status: str | None = None, owner_id: str | None = None) -> list[dict]:
    query: dict = {}
    if status:
        query["status"] = status
    if owner_id:
        query["ownerId"] = owner_id
    cursor = get_db().assets.find(query).sort("createdAt", -1)
    return [d async for d in cursor]


async def decide_asset(
    asset_id: str,
    decision: AssetStatus,
    *,
    admin_note: str | None = None,
    reviewed_by_user_id: str | None = None,
) -> dict | None:
    """Approve or reject an asset. REJECT requires an admin note (enforced here)."""
    decision_value = decision.value if isinstance(decision, AssetStatus) else decision
    if decision_value == AssetStatus.REJECTED.value and not admin_note:
        raise ValueError("adminNote is required when rejecting an asset")

    changes = {
        "status": decision_value,
        "adminNote": admin_note,
        "reviewedByUserId": reviewed_by_user_id,
        "reviewedAt": datetime.now(timezone.utc),
    }
    await get_db().assets.update_one({"_id": asset_id}, {"$set": changes})
    return await get_db().assets.find_one({"_id": asset_id})


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


async def write_audit(
    *,
    action: AuditAction,
    entity_type: str,
    entity_id: str,
    actor_label: str,
    actor_id: str | None = None,
    payload: dict | None = None,
) -> dict:
    entry = AuditLog(
        action=action,
        entityType=entity_type,
        entityId=entity_id,
        actorLabel=actor_label,
        actorId=actor_id,
        payload=payload or {},
    )
    doc = entry.model_dump(by_alias=True)
    await get_db().auditLog.insert_one(doc)
    return doc


async def list_audit(
    *,
    actor_id: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    limit: int = 100,
) -> list[dict]:
    query: dict = {}
    if actor_id:
        query["actorId"] = actor_id
    if action:
        query["action"] = action
    if entity_type:
        query["entityType"] = entity_type
    if date_from or date_to:
        at: dict = {}
        if date_from:
            at["$gte"] = date_from
        if date_to:
            at["$lte"] = date_to
        query["at"] = at
    if q:
        query["$or"] = [
            {"actorLabel": {"$regex": q, "$options": "i"}},
            {"entityId": {"$regex": q, "$options": "i"}},
        ]
    cursor = get_db().auditLog.find(query).sort("at", -1).limit(limit)
    return [d async for d in cursor]


# ---------------------------------------------------------------------------
# Extra reads (detail pages, dashboard)
# ---------------------------------------------------------------------------


async def get_task(task_id: str) -> dict | None:
    return await get_db().tasks.find_one({"_id": task_id})


async def list_pings_for_user(user_id: str, limit: int = 50) -> list[dict]:
    cursor = get_db().pings.find({"userId": user_id}).sort("at", -1).limit(limit)
    return [d async for d in cursor]


async def all_users() -> list[dict]:
    return [u async for u in get_db().users.find()]


async def get_users_by_ids(user_ids: list[str]) -> list[dict]:
    cursor = get_db().users.find({"_id": {"$in": user_ids}})
    return [u async for u in cursor]


async def count_users() -> int:
    return await get_db().users.count_documents({})


async def count_assets_by_status(status: str) -> int:
    return await get_db().assets.count_documents({"status": status})


async def count_projects_by_statuses(statuses: list[str]) -> int:
    return await get_db().projects.count_documents({"status": {"$in": statuses}})


async def task_progress(project_id: str) -> dict:
    """Return {total, completed, byStatus} for a project's tasks."""
    tasks = await list_tasks(project_id=project_id)
    by_status: dict[str, int] = {}
    for t in tasks:
        by_status[t["status"]] = by_status.get(t["status"], 0) + 1
    completed = by_status.get("COMPLETED", 0)
    return {"total": len(tasks), "completed": completed, "byStatus": by_status}


async def list_blocked_tasks(limit: int = 50) -> list[dict]:
    cursor = get_db().tasks.find({"status": "BLOCKED"}).sort("updatedAt", -1).limit(limit)
    return [d async for d in cursor]


async def pings_since(since: datetime) -> list[dict]:
    cursor = get_db().pings.find({"at": {"$gte": since}}).sort("at", 1)
    return [d async for d in cursor]


async def next_project_sequence() -> int:
    """A simple monotonic-ish sequence for auto-generated project codes."""
    return await get_db().projects.count_documents({}) + 1
