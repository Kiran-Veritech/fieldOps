"""Projects: list/create/detail, add members, AI task generation (draft only),
and commit of reviewed tasks."""

from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status

from .. import ai
from .. import repository as repo
from ..deps import get_current_user, require_admin
from ..models import (
    AuditAction,
    Project,
    StatusHistoryEntry,
    Task,
    TaskStatus,
)
from ..schemas import (
    CommitTasksRequest,
    GenerateTasksRequest,
    MembersAdd,
    ProjectCreate,
    UserPublic,
)

router = APIRouter(prefix="/projects", tags=["projects"])

ACTIVE_STATUSES = ["ACTIVE", "AT_RISK"]


async def _project_or_404(project_id: str) -> dict:
    project = await repo.get_project(project_id)
    if project is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("")
async def list_projects(
    status: str | None = None, admin: dict = Depends(require_admin)
) -> list[dict]:
    projects = await repo.list_projects(status=status)
    out = []
    for p in projects:
        progress = await repo.task_progress(p["_id"])
        out.append({**p, "memberCount": len(p.get("memberIds", [])), "progress": progress})
    return out


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, admin: dict = Depends(require_admin)) -> dict:
    code = body.code or f"PRJ-{random.randint(1000, 9999)}"
    project = Project(
        code=code,
        name=body.name,
        description=body.description,
        priority=body.priority,
        startDate=body.startDate,
        targetEndDate=body.targetEndDate,
        status=body.status,
        memberIds=body.memberIds,
    )
    doc = await repo.create_project(project)
    await repo.write_audit(
        action=AuditAction.CREATE,
        entity_type="project",
        entity_id=doc["_id"],
        actor_label=admin["fullName"],
        actor_id=admin["_id"],
        payload={"code": doc["code"], "name": doc["name"]},
    )
    return doc


@router.get("/mine")
async def list_my_projects(user: dict = Depends(get_current_user)) -> list[dict]:
    """Projects the signed-in field employee belongs to (id, code, name, status)."""
    projects = await repo.list_projects_for_member(user["_id"])
    return [
        {
            "_id": p["_id"],
            "code": p["code"],
            "name": p["name"],
            "status": p["status"],
            "priority": p.get("priority"),
        }
        for p in projects
    ]


@router.get("/{project_id}")
async def get_project_detail(project_id: str, admin: dict = Depends(require_admin)) -> dict:
    project = await _project_or_404(project_id)
    members = await repo.get_users_by_ids(project.get("memberIds", []))
    tasks = await repo.list_tasks(project_id=project_id)
    progress = await repo.task_progress(project_id)
    return {
        "project": project,
        "members": [UserPublic.from_doc(m) for m in members],
        "tasks": tasks,
        "progress": progress,
    }


@router.post("/{project_id}/members")
async def add_members(
    project_id: str, body: MembersAdd, admin: dict = Depends(require_admin)
) -> dict:
    await _project_or_404(project_id)
    updated = await repo.add_project_members(project_id, body.userIds)
    await repo.write_audit(
        action=AuditAction.ASSIGN,
        entity_type="project",
        entity_id=project_id,
        actor_label=admin["fullName"],
        actor_id=admin["_id"],
        payload={"added": body.userIds},
    )
    return updated


@router.post("/{project_id}/generate-tasks")
async def generate_tasks(
    project_id: str, body: GenerateTasksRequest, admin: dict = Depends(require_admin)
) -> dict:
    project = await _project_or_404(project_id)
    members = await repo.get_users_by_ids(project.get("memberIds", []))
    team = [
        {
            "id": m["_id"],
            "fullName": m["fullName"],
            "designation": m["designation"],
            "category": m["category"],
        }
        for m in members
    ]

    context = {
        "projectId": project_id,
        "name": project["name"],
        "description": project.get("description", ""),
        "objectives": body.objectives,
        "timeline": body.timeline,
        "team": team,
    }
    if body.simulate:
        context["_simulate"] = body.simulate

    try:
        drafts = await ai.generate_tasks(context)
    except ai.AIError as e:
        # Typed error the UI can render; nothing was persisted.
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    await repo.write_audit(
        action=AuditAction.GENERATE,
        entity_type="project",
        entity_id=project_id,
        actor_label=admin["fullName"],
        actor_id=admin["_id"],
        payload={"count": len(drafts), "objectives": body.objectives},
    )

    return {
        "projectId": project_id,
        "persisted": False,
        "count": len(drafts),
        "generatedAt": datetime.now(timezone.utc),
        "draft": drafts,
    }


@router.post("/{project_id}/tasks/commit", status_code=http_status.HTTP_201_CREATED)
async def commit_tasks(
    project_id: str, body: CommitTasksRequest, admin: dict = Depends(require_admin)
) -> dict:
    await _project_or_404(project_id)
    now = datetime.now(timezone.utc)

    models = []
    for item in body.tasks:
        models.append(
            Task(
                projectId=project_id,
                title=item.title,
                description=item.description,
                assigneeId=item.assigneeId,
                priority=item.priority,
                dueDate=item.dueDate,
                status=TaskStatus.PENDING,
                source=item.source,
                createdAt=now,
                updatedAt=now,
                statusHistory=[
                    StatusHistoryEntry(
                        status=TaskStatus.PENDING, at=now, byUserId=item.assigneeId
                    ).model_dump()
                ],
            )
        )
    docs = await repo.commit_tasks(models)

    await repo.write_audit(
        action=AuditAction.CREATE,
        entity_type="task",
        entity_id=project_id,
        actor_label=admin["fullName"],
        actor_id=admin["_id"],
        payload={"committed": len(docs), "source": "ai_review"},
    )
    return {"projectId": project_id, "committed": len(docs), "tasks": docs}
