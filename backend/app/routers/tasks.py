"""Tasks: list with filters, and status transitions (BLOCKED requires a reason)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status

from .. import repository as repo
from ..deps import get_current_user
from ..models import AuditAction
from ..schemas import TaskPatch

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
async def list_tasks(
    projectId: str | None = None,
    assigneeId: str | None = None,
    status: str | None = None,
    user: dict = Depends(get_current_user),
) -> list[dict]:
    return await repo.list_tasks(project_id=projectId, assignee_id=assigneeId, status=status)


@router.patch("/{task_id}")
async def patch_task(
    task_id: str, body: TaskPatch, user: dict = Depends(get_current_user)
) -> dict:
    task = await repo.get_task(task_id)
    if task is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Task not found")

    try:
        updated = await repo.update_task_status(
            task_id,
            body.status,
            blocked_reason=body.blockedReason,
            by_user_id=user["_id"],
        )
    except ValueError as e:
        # BLOCKED without a reason.
        raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    await repo.write_audit(
        action=AuditAction.UPDATE,
        entity_type="task",
        entity_id=task_id,
        actor_label=user["fullName"],
        actor_id=user["_id"],
        payload={
            "status": body.status.value,
            "blockedReason": body.blockedReason,
        },
    )
    return updated
