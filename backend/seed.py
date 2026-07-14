"""Seed the FieldOps Nexus database with realistic demo data.

"Seed" = fill the DB with fake sample data so the UI isn't empty while building.
Run it once after MongoDB is up:

    cd backend
    ./.venv/bin/python seed.py

It CLEARS the FieldOps collections first, then inserts:
  - ~20 users across all five designation categories (mixed online/offline)
  - pings backing each user's presence
  - 4 projects (planning / active / at-risk / completed)
  - ~12 tasks per active project across all statuses (blocked ones carry a reason)
  - 8 assets (pending / approved / rejected-with-note)
  - a device-reuse flag + an audit-log trail
"""

from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone

from app.db import close_mongo_connection, connect_to_mongo, ensure_indexes, get_db
from app.models import (
    Asset,
    AssetStatus,
    AuditAction,
    GeoPoint,
    InitialLocation,
    Ping,
    Priority,
    Project,
    ProjectStatus,
    Role,
    StatusHistoryEntry,
    Task,
    TaskSource,
    TaskStatus,
    User,
    UserFlag,
    category_for,
)
from app.models import Designation as D
from app.security import hash_password

random.seed(42)

APPROVED_DOMAIN = "fieldops.io"
# Every seeded user shares this password so login is testable out of the box.
DEMO_PASSWORD = "FieldOps!23"
CITY = (28.4595, 77.0266)  # Gurugram / Delhi NCR command area (matches the design)
# Bounding box the Live Map projects into; keep in sync with admin map projection.
NCR_BOUNDS = {"minLat": 28.40, "maxLat": 28.72, "minLng": 76.98, "maxLng": 77.34}
COLLECTIONS = ["users", "pings", "projects", "tasks", "assets", "auditLog"]


def now() -> datetime:
    return datetime.now(timezone.utc)


def scatter() -> GeoPoint:
    return GeoPoint(
        lat=round(random.uniform(NCR_BOUNDS["minLat"], NCR_BOUNDS["maxLat"]), 6),
        lng=round(random.uniform(NCR_BOUNDS["minLng"], NCR_BOUNDS["maxLng"]), 6),
    )


def email_for(name: str) -> str:
    return name.lower().replace(" ", ".") + "@" + APPROVED_DOMAIN


# (full name, designation, role) — 20 people, all five categories represented.
PEOPLE = [
    ("Ava Mitchell", D.TECH_LEAD, Role.EMPLOYEE),
    ("Noah Bennett", D.SENIOR_SOFTWARE_ENGINEER, Role.EMPLOYEE),
    ("Liam Carter", D.BACKEND_DEVELOPER, Role.EMPLOYEE),
    ("Priya Nair", D.FRONTEND_DEVELOPER, Role.EMPLOYEE),
    ("Marcus Cole", D.MOBILE_APP_DEVELOPER, Role.EMPLOYEE),
    ("Sofia Reyes", D.SOFTWARE_ENGINEER, Role.EMPLOYEE),
    ("Ethan Wright", D.SENIOR_QA_ENGINEER, Role.EMPLOYEE),
    ("Hana Kim", D.QA_ENGINEER, Role.EMPLOYEE),
    ("Diego Alvarez", D.UI_UX_DESIGNER, Role.EMPLOYEE),
    ("Olivia Grant", D.DELIVERY_MANAGER, Role.EMPLOYEE),
    ("Ryan Patel", D.PROJECT_MANAGER, Role.EMPLOYEE),
    ("Chloe Duarte", D.PRODUCT_MANAGER, Role.EMPLOYEE),
    ("Sam Okafor", D.BUSINESS_ANALYST, Role.EMPLOYEE),
    ("Maya Iyer", D.DEVOPS_ENGINEER, Role.EMPLOYEE),
    ("Jonas Weber", D.HR_OPERATIONS, Role.EMPLOYEE),
    ("Tara Singh", D.ADMIN, Role.ADMIN),
    ("Victor Lopez", D.DEVOPS_ENGINEER, Role.EMPLOYEE),
    ("Isabel Romano", D.SALES_ACCOUNT_MANAGER, Role.EMPLOYEE),
    ("Grace Chen", D.LEADERSHIP, Role.EMPLOYEE),
    ("Daniel Frost", D.SALES_ACCOUNT_MANAGER, Role.EMPLOYEE),
]

TASK_TITLES = [
    "Define service boundaries and API contract",
    "Set up CI/CD pipeline",
    "Design database schema",
    "Implement authentication flow",
    "Build ingest endpoint",
    "Wire up presence computation",
    "Create admin dashboard shell",
    "Integrate map clustering",
    "Write end-to-end smoke tests",
    "Harden error handling",
    "Draft rollout & runbook",
    "Accessibility & keyboard pass",
    "Performance profiling",
    "Security review of endpoints",
]

BLOCKED_REASONS = [
    "Waiting on staging credentials from Ops",
    "Blocked by upstream API rate limits",
    "Needs design sign-off before proceeding",
    "Dependency package has a breaking change",
]

ASSET_SPECS = [
    ("Dell Latitude 7440", "Laptop"),
    ("iPhone 15 Pro", "Phone"),
    ("DJI Mini 4 Pro", "Drone"),
    ("Fluke 87V Multimeter", "Instrument"),
    ("Anker 737 Power Bank", "Accessory"),
    ("Logitech MX Master 3S", "Peripheral"),
    ("GoPro Hero 12", "Camera"),
    ("Bosch GLM 165 Laser", "Instrument"),
]


async def clear_db() -> None:
    """Wipe FieldOps collections without dropCollection (Atlas readWrite-friendly)."""
    db = get_db()
    for name in COLLECTIONS:
        await db[name].delete_many({})


async def seed_users() -> tuple[list[dict], list[dict]]:
    """Create users (with mixed presence) and their backing pings."""
    db = get_db()
    user_docs: list[dict] = []
    ping_docs: list[dict] = []
    shared_device = "FON-DEVICE-SHARED-01"
    demo_hash = hash_password(DEMO_PASSWORD)  # one hash, reused across demo users

    for idx, (name, designation, role) in enumerate(PEOPLE):
        created = now() - timedelta(days=random.randint(20, 120))
        loc = scatter()

        # ~55% online: pinged within the 60s window. Others offline (minutes→hours).
        online = random.random() < 0.55
        if online:
            last_ping_at = now() - timedelta(seconds=random.randint(3, 55))
        else:
            last_ping_at = now() - timedelta(minutes=random.choice([8, 22, 47, 75, 140, 320]))

        # Sofia (5) and Victor (16) share a device to demonstrate reuse detection.
        device_id = shared_device if idx in (5, 16) else f"FON-{random.randint(10000, 99999):05d}"

        flags = []
        if idx == 16:  # the second registrant on the shared device
            flags.append(
                UserFlag(
                    type="device_reused",
                    detail=f"deviceId {shared_device} already active on another user",
                    at=created,
                ).model_dump()
            )

        user = User(
            fullName=name,
            workEmail=email_for(name),
            designation=designation,
            category=category_for(designation),
            role=role,
            passwordHash=demo_hash,
            deviceId=device_id,
            appVersion=random.choice(["1.0.0", "1.0.1", "1.1.0"]),
            initialLocation=InitialLocation(lat=loc.lat, lng=loc.lng, capturedAt=created),
            lastPingAt=last_ping_at,
            lastLocation=loc,
            createdAt=created,
            status="active",
            flags=flags,
        )
        doc = user.model_dump(by_alias=True)
        user_docs.append(doc)

        # A short trail of pings ending at last_ping_at / lastLocation.
        for j in range(5):
            at = last_ping_at - timedelta(seconds=10 * (4 - j))
            jitter = scatter() if j < 4 else loc
            ping_docs.append(
                Ping(userId=doc["_id"], lat=jitter.lat, lng=jitter.lng, at=at).model_dump(
                    by_alias=True
                )
            )

    await db.users.insert_many(user_docs)
    await db.pings.insert_many(ping_docs)
    return user_docs, ping_docs


async def seed_projects(users: list[dict]) -> list[dict]:
    db = get_db()
    member_pool = [u["_id"] for u in users if u["role"] == "employee"]

    specs = [
        ("PRJ-0472", "Atlas Grid Rollout", ProjectStatus.ACTIVE, Priority.HIGH),
        ("PRJ-0488", "Harbor Telemetry", ProjectStatus.AT_RISK, Priority.HIGH),
        ("PRJ-0501", "Northwind Migration", ProjectStatus.PLANNING, Priority.MEDIUM),
        ("PRJ-0455", "Beacon Field Audit", ProjectStatus.COMPLETED, Priority.LOW),
    ]

    project_docs: list[dict] = []
    for code, name, status, priority in specs:
        start = now() - timedelta(days=random.randint(15, 90))
        members = random.sample(member_pool, k=random.randint(5, 8))
        project = Project(
            code=code,
            name=name,
            description=f"{name} — field coordination workstream.",
            priority=priority,
            startDate=start,
            targetEndDate=start + timedelta(days=random.randint(60, 150)),
            status=status,
            memberIds=members,
            createdAt=start,
        )
        project_docs.append(project.model_dump(by_alias=True))

    await db.projects.insert_many(project_docs)
    return project_docs


async def seed_tasks(projects: list[dict]) -> list[dict]:
    db = get_db()
    active = [p for p in projects if p["status"] in ("ACTIVE", "AT_RISK")]
    all_statuses = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.COMPLETED]

    task_docs: list[dict] = []
    for project in active:
        members = project["memberIds"] or [None]
        titles = random.sample(TASK_TITLES, k=min(12, len(TASK_TITLES)))
        while len(titles) < 12:
            titles.append(random.choice(TASK_TITLES))

        for i, title in enumerate(titles):
            # Guarantee every status appears, then spread the rest.
            status = all_statuses[i] if i < 4 else random.choice(all_statuses)
            assignee = random.choice(members)
            created = now() - timedelta(days=random.randint(2, 30))

            history = [StatusHistoryEntry(status=TaskStatus.PENDING, at=created, byUserId=assignee)]
            blocked_reason = None
            if status == TaskStatus.BLOCKED:
                blocked_reason = random.choice(BLOCKED_REASONS)
            if status != TaskStatus.PENDING:
                history.append(
                    StatusHistoryEntry(
                        status=status,
                        at=created + timedelta(days=1),
                        byUserId=assignee,
                        reason=blocked_reason,
                    )
                )

            task = Task(
                projectId=project["_id"],
                title=title,
                description=f"{title} for {project['name']}.",
                assigneeId=assignee,
                priority=random.choice(list(Priority)),
                dueDate=created + timedelta(days=random.randint(5, 25)),
                status=status,
                blockedReason=blocked_reason,
                source=random.choice([TaskSource.AI, TaskSource.MANUAL]),
                createdAt=created,
                updatedAt=created + timedelta(days=1),
                statusHistory=[h.model_dump() for h in history],
            )
            task_docs.append(task.model_dump(by_alias=True))

    if task_docs:
        await db.tasks.insert_many(task_docs)
    return task_docs


async def seed_assets(users: list[dict], admin: dict) -> list[dict]:
    db = get_db()
    owners = [u["_id"] for u in users if u["role"] == "employee"]
    # 3 pending, 3 approved, 2 rejected (rejected must carry an admin note).
    plan = (
        [(AssetStatus.PENDING, None)] * 3
        + [(AssetStatus.APPROVED, "Verified against procurement records.")] * 3
        + [
            (AssetStatus.REJECTED, "Serial number does not match the asset registry."),
            (AssetStatus.REJECTED, "Photo is unreadable — please re-submit a clear image."),
        ]
    )

    asset_docs: list[dict] = []
    for (status, note), (name, atype) in zip(plan, ASSET_SPECS):
        created = now() - timedelta(days=random.randint(1, 20))
        reviewed = status != AssetStatus.PENDING
        asset = Asset(
            ownerId=random.choice(owners),
            name=name,
            type=atype,
            serialNumber=f"SN-{random.randint(100000, 999999)}",
            description=f"{name} enlisted for field use.",
            photoUrl=None,
            status=status,
            adminNote=note,
            reviewedByUserId=admin["_id"] if reviewed else None,
            reviewedAt=(created + timedelta(days=1)) if reviewed else None,
            createdAt=created,
        )
        asset_docs.append(asset.model_dump(by_alias=True))

    await db.assets.insert_many(asset_docs)
    return asset_docs


async def seed_audit(
    admin: dict, projects: list[dict], assets: list[dict], flagged_user: dict | None
) -> int:
    db = get_db()
    label = admin["fullName"]
    entries = []

    def entry(action, entity_type, entity_id, payload):
        from app.models import AuditLog

        return AuditLog(
            action=action,
            entityType=entity_type,
            entityId=entity_id,
            actorLabel=label,
            actorId=admin["_id"],
            payload=payload,
        ).model_dump(by_alias=True)

    for p in projects:
        entries.append(entry(AuditAction.CREATE, "project", p["_id"], {"code": p["code"]}))
        entries.append(
            entry(AuditAction.ASSIGN, "project", p["_id"], {"memberCount": len(p["memberIds"])})
        )
    active = [p for p in projects if p["status"] in ("ACTIVE", "AT_RISK")]
    for p in active:
        entries.append(entry(AuditAction.GENERATE, "project", p["_id"], {"generated": 12}))
    for a in assets:
        if a["status"] == "APPROVED":
            entries.append(entry(AuditAction.APPROVE, "asset", a["_id"], {"name": a["name"]}))
        elif a["status"] == "REJECTED":
            entries.append(
                entry(AuditAction.REJECT, "asset", a["_id"], {"adminNote": a["adminNote"]})
            )
    if flagged_user is not None:
        entries.append(
            entry(
                AuditAction.FLAG,
                "user",
                flagged_user["_id"],
                {"type": "device_reused", "deviceId": flagged_user["deviceId"]},
            )
        )

    if entries:
        await db.auditLog.insert_many(entries)
    return len(entries)


async def main() -> None:
    await connect_to_mongo()
    print("Clearing existing FieldOps collections…")
    await clear_db()
    await ensure_indexes()

    users, pings = await seed_users()
    admin = next(u for u in users if u["role"] == "admin")
    flagged = next((u for u in users if u["flags"]), None)

    projects = await seed_projects(users)
    tasks = await seed_tasks(projects)
    assets = await seed_assets(users, admin)
    audit_count = await seed_audit(admin, projects, assets, flagged)

    # Report presence split (derived) so the online/offline mix is visible.
    from app.repository import is_online

    online = sum(1 for u in users if is_online(u.get("lastPingAt")))
    active_projects = [p for p in projects if p["status"] in ("ACTIVE", "AT_RISK")]

    print("\nSeed complete:")
    print(f"  users        : {len(users)}  ({online} online / {len(users) - online} offline)")
    print(f"  pings        : {len(pings)}")
    print(f"  projects     : {len(projects)}  ({len(active_projects)} active/at-risk)")
    print(f"  tasks        : {len(tasks)}  (~12 per active project, all statuses)")
    print(f"  assets       : {len(assets)}  (3 pending / 3 approved / 2 rejected)")
    print(f"  auditLog     : {audit_count}")
    print(f"\n  admin login user: {admin['workEmail']}")
    print(f"  demo password   : {DEMO_PASSWORD}  (all seeded users)")

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
