"""Authentication: register (with domain allow-list + device-reuse detection),
login, refresh, and email OTP verification — all JWT-based."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository as repo
from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..mail import generate_otp, send_password_reset_otp, send_verification_otp
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
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserPublic,
    VerifyEmailRequest,
    VerifyResetOtpRequest,
)
from ..security import (
    PASSWORD_RESET,
    REFRESH,
    create_password_reset_token,
    create_token_pair,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _domain_of(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _issue_and_send_otp(user_id: str, email: str, full_name: str) -> None:
    otp = generate_otp()
    expires = _utcnow() + timedelta(minutes=settings.otp_expire_minutes)
    await repo.update_user(
        user_id,
        {
            "emailOtpHash": hash_password(otp),
            "emailOtpExpiresAt": expires,
            "emailOtpSentAt": _utcnow(),
            "emailVerified": False,
        },
    )
    send_verification_otp(to_email=email, full_name=full_name, otp=otp)


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
        passwordHash=hash_password(body.password),
        deviceId=body.deviceId,
        deviceName=device_name,
        appVersion=body.appVersion,
        initialLocation=InitialLocation(
            lat=body.initialLocation.lat, lng=body.initialLocation.lng
        ),
        lastPingAt=None,  # offline until the first ping — "going online" happens after
        lastLocation=None,
        flags=flags,
        emailVerified=False,
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

    try:
        await _issue_and_send_otp(doc["_id"], email, doc["fullName"])
    except RuntimeError as exc:
        # Roll back the incomplete registration so the user can retry.
        await get_db().users.delete_one({"_id": doc["_id"]})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    # Re-read so OTP metadata / emailVerified are current in the response.
    doc = await repo.get_user(doc["_id"]) or doc
    tokens = create_token_pair(doc["_id"], doc["role"])
    return AuthResponse(user=UserPublic.from_doc(doc), tokens=TokenResponse(**tokens))


@router.post("/verify-email", response_model=UserPublic)
async def verify_email(
    body: VerifyEmailRequest, user: dict = Depends(get_current_user)
) -> UserPublic:
    if user.get("emailVerified", True):
        return UserPublic.from_doc(user)

    code = body.code.strip()
    otp_hash = user.get("emailOtpHash")
    expires = user.get("emailOtpExpiresAt")
    if not otp_hash or not expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code pending. Request a new one.",
        )

    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if _utcnow() > expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code expired. Request a new one.",
        )
    if not verify_password(code, otp_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    updated = await repo.update_user(
        user["_id"],
        {
            "emailVerified": True,
            "emailOtpHash": None,
            "emailOtpExpiresAt": None,
            "emailOtpSentAt": None,
        },
    )
    await repo.write_audit(
        action=AuditAction.UPDATE,
        entity_type="user",
        entity_id=user["_id"],
        actor_label=user["fullName"],
        actor_id=user["_id"],
        payload={"email_verified": True},
    )
    return UserPublic.from_doc(updated or {**user, "emailVerified": True})


@router.post("/resend-otp")
async def resend_otp(user: dict = Depends(get_current_user)) -> dict:
    if user.get("emailVerified", True):
        return {"sent": False, "reason": "already_verified"}

    sent_at = user.get("emailOtpSentAt")
    if sent_at is not None:
        if isinstance(sent_at, str):
            sent_at = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)
        if _utcnow() - sent_at < timedelta(seconds=30):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait a moment before requesting another code",
            )

    try:
        await _issue_and_send_otp(user["_id"], user["workEmail"], user["fullName"])
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return {"sent": True}


def _as_aware(dt: datetime | str) -> datetime:
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest) -> dict:
    """Send a password-reset OTP. Always returns the same shape to avoid email enumeration."""
    email = body.workEmail.lower()
    user = await repo.get_user_by_email(email)
    if user is None or user.get("status") != "active":
        return {"sent": True}

    sent_at = user.get("passwordResetOtpSentAt")
    if sent_at is not None:
        sent_at = _as_aware(sent_at)
        if _utcnow() - sent_at < timedelta(seconds=30):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait a moment before requesting another code",
            )

    otp = generate_otp()
    expires = _utcnow() + timedelta(minutes=settings.otp_expire_minutes)
    await repo.update_user(
        user["_id"],
        {
            "passwordResetOtpHash": hash_password(otp),
            "passwordResetOtpExpiresAt": expires,
            "passwordResetOtpSentAt": _utcnow(),
        },
    )
    try:
        send_password_reset_otp(
            to_email=email, full_name=user.get("fullName") or "there", otp=otp
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return {"sent": True}


@router.post("/forgot-password/verify")
async def verify_reset_otp(body: VerifyResetOtpRequest) -> dict:
    """Verify the reset OTP and return a short-lived reset token."""
    user = await repo.get_user_by_email(body.workEmail.lower())
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired verification code",
    )
    if user is None or user.get("status") != "active":
        raise invalid

    otp_hash = user.get("passwordResetOtpHash")
    expires = user.get("passwordResetOtpExpiresAt")
    if not otp_hash or not expires:
        raise invalid

    expires = _as_aware(expires)
    if _utcnow() > expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code expired. Request a new one.",
        )
    if not verify_password(body.code.strip(), otp_hash):
        raise invalid

    token = create_password_reset_token(user["_id"], user.get("role") or Role.EMPLOYEE.value)
    return {"resetToken": token}


@router.post("/forgot-password/reset")
async def reset_password(body: ResetPasswordRequest) -> dict:
    """Set a new password using a reset token from OTP verification."""
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset session. Start again.",
    )
    try:
        payload = decode_token(body.resetToken)
    except jwt.PyJWTError as exc:
        raise invalid from exc

    if payload.get("type") != PASSWORD_RESET:
        raise invalid

    user_id = payload.get("sub")
    user = await repo.get_user(user_id) if user_id else None
    if user is None or user.get("status") != "active":
        raise invalid

    await repo.update_user(
        user["_id"],
        {
            "passwordHash": hash_password(body.password),
            "passwordResetOtpHash": None,
            "passwordResetOtpExpiresAt": None,
            "passwordResetOtpSentAt": None,
        },
    )
    await repo.write_audit(
        action=AuditAction.UPDATE,
        entity_type="user",
        entity_id=user["_id"],
        actor_label=user["fullName"],
        actor_id=user["_id"],
        payload={"password_reset": True},
    )
    return {"ok": True}


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
