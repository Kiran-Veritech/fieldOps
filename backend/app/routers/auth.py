"""Authentication: register (with domain allow-list + device-reuse detection),
login, and refresh — all JWT-based."""

from __future__ import annotations

import jwt
from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository as repo
from ..config import settings
from ..deps import get_current_user
from ..models import (
    AuditAction,
    InitialLocation,
    Role,
    User,
    UserFlag,
    category_for,
)
from ..schemas import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from ..security import (
    REFRESH,
    create_token_pair,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _domain_of(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


@router.get("/domains")
async def approved_domains() -> dict:
    """Public: the approved work-email domains, so the app can validate inline."""
    return {"approvedDomains": settings.approved_domain_list}


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> AuthResponse:
    email = body.workEmail.lower()
    domain = _domain_of(email)

    # Domain allow-list — clear 422 for a non-approved domain.
    if domain not in settings.approved_domain_list:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{domain} is not an approved domain",
        )

    if await repo.get_user_by_email(email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this work email already exists",
        )

    # Device-ID reuse detection across active users.
    reused = await repo.find_active_users_by_device(body.deviceId)
    flags: list[dict] = []
    if reused:
        other = reused[0]
        flags.append(
            UserFlag(
                type="device_reused",
                detail=f"deviceId {body.deviceId} already active on {other['fullName']}",
            ).model_dump()
        )

    designation = body.designation
    device_name = (body.deviceName or "").strip()
    user = User(
        fullName=body.fullName,
        workEmail=email,
        designation=designation,
        category=category_for(designation),
        role=Role.EMPLOYEE,
        passwordHash=hash_password(body.password) if body.password else None,
        deviceId=body.deviceId,
        deviceName=device_name,
        appVersion=body.appVersion,
        initialLocation=InitialLocation(
            lat=body.initialLocation.lat, lng=body.initialLocation.lng
        ),
        lastPingAt=None,  # offline until the first ping — "going online" happens after
        lastLocation=None,
        flags=flags,
    )
    doc = await repo.create_user(user)

    await repo.write_audit(
        action=AuditAction.CREATE,
        entity_type="user",
        entity_id=doc["_id"],
        actor_label=doc["fullName"],
        actor_id=doc["_id"],
        payload={"designation": doc["designation"], "self_registration": True},
    )
    if flags:
        await repo.write_audit(
            action=AuditAction.FLAG,
            entity_type="user",
            entity_id=doc["_id"],
            actor_label="system",
            payload={"type": "device_reused", "deviceId": body.deviceId},
        )

    tokens = create_token_pair(doc["_id"], doc["role"])
    return AuthResponse(user=UserPublic.from_doc(doc), tokens=TokenResponse(**tokens))


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest) -> AuthResponse:
    user = await repo.get_user_by_email(body.workEmail.lower())
    if user is None or not verify_password(body.password, user.get("passwordHash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid work email or password",
        )
    if user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This account is deactivated"
        )

    # Persist/refresh device binding when the field app sends it.
    changes: dict = {}
    if body.deviceId:
        new_id = body.deviceId.strip()
        if new_id:
            if new_id != user.get("deviceId"):
                others = [
                    u
                    for u in await repo.find_active_users_by_device(new_id)
                    if u["_id"] != user["_id"]
                ]
                if others:
                    await repo.add_user_flag(
                        user["_id"],
                        UserFlag(
                            type="device_reused",
                            detail=f"deviceId {new_id} already active on {others[0]['fullName']}",
                        ).model_dump(),
                    )
                    await repo.write_audit(
                        action=AuditAction.FLAG,
                        entity_type="user",
                        entity_id=user["_id"],
                        actor_label="system",
                        payload={"type": "device_reused", "deviceId": new_id, "via": "login"},
                    )
            changes["deviceId"] = new_id
    if body.deviceName is not None:
        changes["deviceName"] = body.deviceName.strip()

    if changes:
        user = await repo.update_user(user["_id"], changes) or user

    await repo.write_audit(
        action=AuditAction.LOGIN,
        entity_type="user",
        entity_id=user["_id"],
        actor_label=user["fullName"],
        actor_id=user["_id"],
        payload={
            "role": user["role"],
            "deviceId": user.get("deviceId"),
            "deviceName": user.get("deviceName") or "",
        },
    )

    tokens = create_token_pair(user["_id"], user["role"])
    return AuthResponse(user=UserPublic.from_doc(user), tokens=TokenResponse(**tokens))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest) -> TokenResponse:
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
    )
    try:
        payload = decode_token(body.refreshToken)
    except jwt.PyJWTError:
        raise invalid

    if payload.get("type") != REFRESH:
        raise invalid

    user_id = payload.get("sub")
    user = await repo.get_user(user_id) if user_id else None
    if user is None or user.get("status") != "active":
        raise invalid

    tokens = create_token_pair(user["_id"], user["role"])
    return TokenResponse(**tokens)


@router.get("/whoami", response_model=UserPublic, include_in_schema=False)
async def whoami(user: dict = Depends(get_current_user)) -> UserPublic:
    return UserPublic.from_doc(user)
