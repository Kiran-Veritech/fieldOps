"""Password hashing (bcrypt) and JWT access/refresh token helpers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings

ACCESS = "access"
REFRESH = "refresh"
PASSWORD_RESET = "password_reset"


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------


def _create_token(sub: str, role: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(sub: str, role: str) -> str:
    return _create_token(
        sub, role, ACCESS, timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(sub: str, role: str) -> str:
    return _create_token(
        sub, role, REFRESH, timedelta(days=settings.refresh_token_expire_days)
    )


def create_password_reset_token(sub: str, role: str) -> str:
    """Short-lived token issued after a successful forgot-password OTP check."""
    return _create_token(sub, role, PASSWORD_RESET, timedelta(minutes=15))


def create_token_pair(sub: str, role: str) -> dict:
    return {
        "accessToken": create_access_token(sub, role),
        "refreshToken": create_refresh_token(sub, role),
        "tokenType": "bearer",
    }


def decode_token(token: str) -> dict:
    """Decode/verify a JWT. Raises jwt.PyJWTError on any problem."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
