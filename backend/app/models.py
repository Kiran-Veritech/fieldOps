"""Pydantic models for the FieldOps Nexus data model (§2 of BUILD_PROMPT).

These mirror the MongoDB collections one-to-one. Documents use a string `_id`
(uuid hex) so cross-collection references are plain strings and the API can
serialise them without ObjectId gymnastics.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------------------------
# Presence
# ---------------------------------------------------------------------------

# A user is ONLINE if a ping was received within this window. Presence is always
# DERIVED from `now - lastPingAt`; never stored as a boolean.
PRESENCE_WINDOW_SECONDS = 60


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class Category(str, Enum):
    ENGINEERING = "Engineering"
    QUALITY = "Quality"
    DELIVERY = "Delivery"
    OPERATIONS = "Operations"
    BUSINESS = "Business"


class Designation(str, Enum):
    # Engineering
    SOFTWARE_ENGINEER = "Software Engineer"
    SENIOR_SOFTWARE_ENGINEER = "Senior Software Engineer"
    TECH_LEAD = "Tech Lead"
    BACKEND_DEVELOPER = "Backend Developer"
    FRONTEND_DEVELOPER = "Frontend Developer"
    MOBILE_APP_DEVELOPER = "Mobile App Developer"
    # Quality & Design
    QA_ENGINEER = "QA Engineer"
    SENIOR_QA_ENGINEER = "Senior QA Engineer"
    UI_UX_DESIGNER = "UI/UX Designer"
    # Delivery
    PROJECT_MANAGER = "Project Manager"
    DELIVERY_MANAGER = "Delivery Manager"
    PRODUCT_MANAGER = "Product Manager"
    BUSINESS_ANALYST = "Business Analyst"
    # Operations
    DEVOPS_ENGINEER = "DevOps Engineer"
    HR_OPERATIONS = "HR / Operations"
    ADMIN = "Admin"
    # Business
    SALES_ACCOUNT_MANAGER = "Sales / Account Manager"
    LEADERSHIP = "Leadership"


DESIGNATION_TO_CATEGORY: dict[Designation, Category] = {
    Designation.SOFTWARE_ENGINEER: Category.ENGINEERING,
    Designation.SENIOR_SOFTWARE_ENGINEER: Category.ENGINEERING,
    Designation.TECH_LEAD: Category.ENGINEERING,
    Designation.BACKEND_DEVELOPER: Category.ENGINEERING,
    Designation.FRONTEND_DEVELOPER: Category.ENGINEERING,
    Designation.MOBILE_APP_DEVELOPER: Category.ENGINEERING,
    Designation.QA_ENGINEER: Category.QUALITY,
    Designation.SENIOR_QA_ENGINEER: Category.QUALITY,
    Designation.UI_UX_DESIGNER: Category.QUALITY,
    Designation.PROJECT_MANAGER: Category.DELIVERY,
    Designation.DELIVERY_MANAGER: Category.DELIVERY,
    Designation.PRODUCT_MANAGER: Category.DELIVERY,
    Designation.BUSINESS_ANALYST: Category.DELIVERY,
    Designation.DEVOPS_ENGINEER: Category.OPERATIONS,
    Designation.HR_OPERATIONS: Category.OPERATIONS,
    Designation.ADMIN: Category.OPERATIONS,
    Designation.SALES_ACCOUNT_MANAGER: Category.BUSINESS,
    Designation.LEADERSHIP: Category.BUSINESS,
}


def category_for(designation: Designation) -> Category:
    return DESIGNATION_TO_CATEGORY[designation]


class Role(str, Enum):
    EMPLOYEE = "employee"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    DEACTIVATED = "deactivated"


class Priority(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ProjectStatus(str, Enum):
    PLANNING = "PLANNING"
    ACTIVE = "ACTIVE"
    AT_RISK = "AT_RISK"
    COMPLETED = "COMPLETED"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"


class TaskSource(str, Enum):
    AI = "ai"
    MANUAL = "manual"


class AssetStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class AuditAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    CREATE = "create"
    ASSIGN = "assign"
    GENERATE = "generate"
    FLAG = "flag"
    LOGIN = "login"
    UPDATE = "update"


# ---------------------------------------------------------------------------
# Shared base + sub-documents
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MongoModel(BaseModel):
    """Base for stored documents: string `_id`, enums serialised as values."""

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        arbitrary_types_allowed=True,
    )

    id: str = Field(default_factory=lambda: uuid4().hex, alias="_id")


class InitialLocation(BaseModel):
    lat: float
    lng: float
    capturedAt: datetime = Field(default_factory=_utcnow)


class GeoPoint(BaseModel):
    lat: float
    lng: float


class UserFlag(BaseModel):
    type: str  # e.g. "device_reused"
    detail: str
    at: datetime = Field(default_factory=_utcnow)


class StatusHistoryEntry(BaseModel):
    status: TaskStatus
    at: datetime = Field(default_factory=_utcnow)
    byUserId: str | None = None
    reason: str | None = None


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class User(MongoModel):
    fullName: str
    workEmail: EmailStr
    designation: Designation
    category: Category
    role: Role = Role.EMPLOYEE
    passwordHash: str | None = None
    deviceId: str
    appVersion: str
    initialLocation: InitialLocation
    lastPingAt: datetime | None = None
    lastLocation: GeoPoint | None = None
    createdAt: datetime = Field(default_factory=_utcnow)
    status: UserStatus = UserStatus.ACTIVE
    flags: list[UserFlag] = Field(default_factory=list)


class Ping(MongoModel):
    userId: str
    lat: float
    lng: float
    at: datetime = Field(default_factory=_utcnow)


class Project(MongoModel):
    code: str
    name: str
    description: str
    priority: Priority
    startDate: datetime
    targetEndDate: datetime
    status: ProjectStatus
    memberIds: list[str] = Field(default_factory=list)
    createdAt: datetime = Field(default_factory=_utcnow)


class Task(MongoModel):
    projectId: str
    title: str
    description: str
    assigneeId: str | None = None
    priority: Priority = Priority.MEDIUM
    dueDate: datetime | None = None
    status: TaskStatus = TaskStatus.PENDING
    blockedReason: str | None = None
    source: TaskSource = TaskSource.MANUAL
    createdAt: datetime = Field(default_factory=_utcnow)
    updatedAt: datetime = Field(default_factory=_utcnow)
    statusHistory: list[StatusHistoryEntry] = Field(default_factory=list)


class Asset(MongoModel):
    ownerId: str
    name: str
    type: str
    serialNumber: str
    description: str
    photoUrl: str | None = None
    status: AssetStatus = AssetStatus.PENDING
    adminNote: str | None = None
    reviewedByUserId: str | None = None
    reviewedAt: datetime | None = None
    createdAt: datetime = Field(default_factory=_utcnow)


class AuditLog(MongoModel):
    at: datetime = Field(default_factory=_utcnow)
    actorId: str | None = None
    actorLabel: str
    action: AuditAction
    entityType: str
    entityId: str
    payload: dict = Field(default_factory=dict)
