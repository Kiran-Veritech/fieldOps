"""Assets: employee enlist (multipart if a photo is attached) and the admin
approve/reject decision (REJECT requires an admin note)."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi import status as http_status

from .. import repository as repo
from ..deps import get_current_user, require_admin
from ..models import Asset, AssetStatus, AuditAction
from ..schemas import AssetDecisionRequest

router = APIRouter(prefix="/assets", tags=["assets"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_STATUS_MAP = {
    "pending": AssetStatus.PENDING,
    "approved": AssetStatus.APPROVED,
    "rejected": AssetStatus.REJECTED,
}


@router.get("")
async def list_assets(status: str | None = None, admin: dict = Depends(require_admin)) -> list[dict]:
    status_value = None
    if status:
        mapped = _STATUS_MAP.get(status.lower())
        status_value = mapped.value if mapped else status.upper()
    return await repo.list_assets(status=status_value)


@router.get("/mine")
async def list_my_assets(
    status: str | None = None, user: dict = Depends(get_current_user)
) -> list[dict]:
    """The signed-in field employee's own enlisted assets (any status)."""
    status_value = None
    if status:
        mapped = _STATUS_MAP.get(status.lower())
        status_value = mapped.value if mapped else status.upper()
    return await repo.list_assets(status=status_value, owner_id=user["_id"])


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def enlist_asset(
    name: str = Form(...),
    type: str = Form(...),
    serialNumber: str = Form(...),
    description: str = Form(""),
    photo: UploadFile | None = File(None),
    user: dict = Depends(get_current_user),
) -> dict:
    photo_url = None
    if photo is not None:
        suffix = Path(photo.filename or "").suffix or ".bin"
        fname = f"{uuid.uuid4().hex}{suffix}"
        dest = UPLOAD_DIR / fname
        dest.write_bytes(await photo.read())
        photo_url = f"/uploads/{fname}"

    asset = Asset(
        ownerId=user["_id"],
        name=name,
        type=type,
        serialNumber=serialNumber,
        description=description,
        photoUrl=photo_url,
        status=AssetStatus.PENDING,
    )
    doc = await repo.create_asset(asset)

    await repo.write_audit(
        action=AuditAction.CREATE,
        entity_type="asset",
        entity_id=doc["_id"],
        actor_label=user["fullName"],
        actor_id=user["_id"],
        payload={"name": name, "serialNumber": serialNumber},
    )
    return doc


@router.patch("/{asset_id}/decision")
async def decide_asset(
    asset_id: str, body: AssetDecisionRequest, admin: dict = Depends(require_admin)
) -> dict:
    decision = body.decision.lower()
    admin_note = body.adminNote

    if decision not in ("approve", "reject"):
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="decision must be 'approve' or 'reject'",
        )

    if await repo.get_asset(asset_id) is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Asset not found")

    target = AssetStatus.APPROVED if decision == "approve" else AssetStatus.REJECTED
    try:
        updated = await repo.decide_asset(
            asset_id,
            target,
            admin_note=admin_note,
            reviewed_by_user_id=admin["_id"],
        )
    except ValueError as e:
        # REJECT without an admin note.
        raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    await repo.write_audit(
        action=AuditAction.APPROVE if decision == "approve" else AuditAction.REJECT,
        entity_type="asset",
        entity_id=asset_id,
        actor_label=admin["fullName"],
        actor_id=admin["_id"],
        payload={"decision": decision, "adminNote": admin_note},
    )
    return updated
