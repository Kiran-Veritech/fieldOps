"""Request/response schemas for the auth + presence endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from .models import (
    Category,
    Designation,
    Priority,
    ProjectStatus,
    Role,
    TaskStatus,
    UserStatus,
)
from .repository import is_online


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


class LocationIn(BaseModel):
    lat: float
    lng: float


class RegisterRequest(BaseModel):
    workEmail: EmailStr
    fullName: str = Field(min_length=1)
    designation: Designation
    deviceId: str = Field(min_length=1)
    appVersion: str = "1.0.0"
    initialLocation: LocationIn
    # Employees register from the app; a password lets them (and admins) use
    # the /auth/login endpoint later. Optional to match the app's flow.
    password: str | None = Field(default=None, min_length=6)


class LoginRequest(BaseModel):
    workEmail: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class PingRequest(BaseModel):
    lat: float
    lng: float


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"


class UserPublic(BaseModel):
    id: str
    fullName: str
    workEmail: EmailStr
    designation: Designation
    category: Category
    role: Role
    deviceId: str
    appVersion: str
    status: UserStatus
    lastPingAt: datetime | None = None
    lastLocation: dict | None = None
    initialLocation: dict | None = None
    createdAt: datetime | None = None
    flags: list[dict] = []
    online: bool = False

    @classmethod
    def from_doc(cls, doc: dict, now: datetime | None = None) -> "UserPublic":
        return cls(
            id=doc["_id"],
            fullName=doc["fullName"],
            workEmail=doc["workEmail"],
            designation=doc["designation"],
            category=doc["category"],
            role=doc["role"],
            deviceId=doc["deviceId"],
            appVersion=doc["appVersion"],
            status=doc["status"],
            lastPingAt=doc.get("lastPingAt"),
            lastLocation=doc.get("lastLocation"),
            initialLocation=doc.get("initialLocation"),
            createdAt=doc.get("createdAt"),
            flags=doc.get("flags", []),
            online=is_online(doc.get("lastPingAt"), now),
        )


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: TokenResponse


class PingResponse(BaseModel):
    recorded: bool
    at: datetime
    online: bool


# ---------------------------------------------------------------------------
# Users (admin)
# ---------------------------------------------------------------------------


class UserPatch(BaseModel):
    designation: Designation | None = None
    status: UserStatus | None = None
    deviceId: str | None = None


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    priority: Priority = Priority.MEDIUM
    startDate: datetime
    targetEndDate: datetime
    status: ProjectStatus = ProjectStatus.PLANNING
    code: str | None = None
    memberIds: list[str] = Field(default_factory=list)


class MembersAdd(BaseModel):
    userIds: list[str] = Field(min_length=1)


class GenerateTasksRequest(BaseModel):
    objectives: list[str] = Field(default_factory=list)
    timeline: str | None = None
    # test hook to exercise the failure surface: "timeout" | "badjson"
    simulate: str | None = None


class DraftTask(BaseModel):
    """Shape returned by the AI (a DRAFT — never persisted until commit)."""

    title: str
    description: str
    suggestedAssigneeId: str | None = None
    priority: Priority = Priority.MEDIUM
    dueDate: datetime | None = None


class CommitTaskItem(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    assigneeId: str | None = None
    priority: Priority = Priority.MEDIUM
    dueDate: datetime | None = None
    source: str = "ai"


class CommitTasksRequest(BaseModel):
    tasks: list[CommitTaskItem] = Field(min_length=1)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


class TaskPatch(BaseModel):
    status: TaskStatus
    blockedReason: str | None = None


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------


class AssetDecisionRequest(BaseModel):
    decision: str  # "approve" | "reject"
    adminNote: str | None = None
