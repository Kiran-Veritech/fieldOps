"""Admin dashboard summary: live counts, recent ping feed, needs-attention
buckets, and a 24h online/offline series."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from .. import repository as repo
from ..deps import require_admin
from ..models import PRESENCE_WINDOW_SECONDS
from ..repository import is_online

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ACTIVE_STATUSES = ["ACTIVE", "AT_RISK"]
OFFLINE_ATTENTION_SECONDS = 3600  # offline for more than 1 hour


@router.get("/summary")
async def summary(admin: dict = Depends(require_admin)) -> dict:
    now = datetime.now(timezone.utc)
    users = await repo.all_users()

    online_ids = {u["_id"] for u in users if is_online(u.get("lastPingAt"), now)}
    online_count = len(online_ids)
    offline_count = len(users) - online_count

    pending_approvals = await repo.count_assets_by_status("PENDING")
    active_projects = await repo.count_projects_by_statuses(ACTIVE_STATUSES)

    # Recent sync activity feed.
    name_by_id = {u["_id"]: u for u in users}
    recent = await repo.list_recent_pings(limit=15)
    recent_feed = []
    for p in recent:
        owner = name_by_id.get(p["userId"], {})
        recent_feed.append(
            {
                "userId": p["userId"],
                "fullName": owner.get("fullName"),
                "designation": owner.get("designation"),
                "category": owner.get("category"),
                "lat": p["lat"],
                "lng": p["lng"],
                "at": p["at"],
            }
        )

    # Needs-attention buckets.
    def _seconds_since(dt) -> float | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (now - dt).total_seconds()

    offline_over_hour = []
    for u in users:
        secs = _seconds_since(u.get("lastPingAt"))
        if secs is None or secs > OFFLINE_ATTENTION_SECONDS:
            offline_over_hour.append(
                {
                    "id": u["_id"],
                    "fullName": u["fullName"],
                    "designation": u["designation"],
                    "lastPingAt": u.get("lastPingAt"),
                }
            )

    blocked = await repo.list_blocked_tasks(limit=50)
    blocked_tasks = [
        {
            "id": t["_id"],
            "title": t["title"],
            "projectId": t["projectId"],
            "blockedReason": t.get("blockedReason"),
        }
        for t in blocked
    ]

    # 24h online/offline series — distinct pingers per hour bucket.
    since = now - timedelta(hours=24)
    pings = await repo.pings_since(since)
    buckets: list[set] = [set() for _ in range(24)]
    for p in pings:
        at = p["at"]
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        idx = int((at - since).total_seconds() // 3600)
        if 0 <= idx < 24:
            buckets[idx].add(p["userId"])
    total_users = len(users)
    series_24h = []
    for i, bucket in enumerate(buckets):
        hour_start = since + timedelta(hours=i)
        online = len(bucket)
        series_24h.append(
            {
                "hour": hour_start.replace(minute=0, second=0, microsecond=0),
                "online": online,
                "offline": max(total_users - online, 0),
            }
        )

    return {
        "counts": {
            "onboarded": total_users,
            "online": online_count,
            "offline": offline_count,
            "pendingApprovals": pending_approvals,
            "activeProjects": active_projects,
        },
        "presenceWindowSeconds": PRESENCE_WINDOW_SECONDS,
        "recentPings": recent_feed,
        "needsAttention": {
            "pendingApprovals": pending_approvals,
            "offlineOverAnHour": offline_over_hour,
            "blockedTasks": blocked_tasks,
        },
        "series24h": series_24h,
    }
