# app/schemas.py
from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, constr


# ------------------------------------------------------------
# Общие enum'ы
# ------------------------------------------------------------
class TaskStatus(str, enum.Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ------------------------------------------------------------
# Гео-точка
# ------------------------------------------------------------
class LatLngPoint(BaseModel):
    lat: float
    lng: float


# ------------------------------------------------------------
# Pyrotechnicians
# ------------------------------------------------------------
class PyrotechnicianBase(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: str
    role: Optional[str] = None
    rank: Optional[str] = None


class PyrotechnicianCreate(PyrotechnicianBase):
    password: Optional[str] = None


class PyrotechnicianUpdate(PyrotechnicianBase):
    password: Optional[str] = None


class Pyrotechnician(PyrotechnicianBase):
    id: int
    is_active: bool
    is_admin: bool
    last_login_at: Optional[datetime] = None
    login_count: int
    must_change_password: bool # <-- НОВОЕ ПОЛЕ

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Teams
# ------------------------------------------------------------
class TeamBase(BaseModel):
    name: str
    lead_id: Optional[int] = None
    organization_unit_id: Optional[int] = None


class TeamCreate(TeamBase):
    member_ids: List[int] = Field(default_factory=list)


class TeamUpdate(TeamBase):
    member_ids: List[int] = Field(default_factory=list)


class TeamPatch(BaseModel):
    name: Optional[str] = None
    lead_id: Optional[int] = None
    organization_unit_id: Optional[int] = None
    member_ids: Optional[List[int]] = None


class Team(BaseModel):
    id: int
    name: str
    lead: Optional[Pyrotechnician] = None
    organization_unit_id: Optional[int] = None
    members: List[Pyrotechnician] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Organization Units / Tree
# ------------------------------------------------------------
class OrganizationUnitBase(BaseModel):
    name: str
    parent_id: Optional[int] = None
    description: Optional[str] = None


class OrganizationUnitCreate(OrganizationUnitBase):
    pass


class OrganizationUnitUpdate(OrganizationUnitBase):
    pass


class OrganizationUnit(OrganizationUnitBase):
    id: int
    children: List["OrganizationUnit"] = Field(default_factory=list)
    teams: List["Team"] = Field(default_factory=list)

    class Config:
        from_attributes = True


class OrganizationNode(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    children: List["OrganizationNode"] = Field(default_factory=list)
    type: str


# ------------------------------------------------------------
# Zones
# ------------------------------------------------------------
class ZoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    points: List[LatLngPoint] = Field(default_factory=list)


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(ZoneBase):
    pass


class Zone(ZoneBase):
    id: int

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Task attachments / comments
# ------------------------------------------------------------
class TaskAttachment(BaseModel):
    id: int
    file_name: str
    mime_type: str
    url: str

    class Config:
        from_attributes = True


class TaskCommentBase(BaseModel):
    text: Optional[str] = None


class TaskCommentCreate(TaskCommentBase):
    pass


class TaskComment(TaskCommentBase):
    id: int
    created_at: datetime
    author: Pyrotechnician
    attachments: List[TaskAttachment] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Tasks
# ------------------------------------------------------------
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.NEW
    priority: TaskPriority = TaskPriority.MEDIUM
    team_id: Optional[int] = None
    zone_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(TaskBase):
    pass


class Task(TaskBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    team: Optional[Team] = None
    zone: Optional[Zone] = None
    comments: List[TaskComment] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Zone with tasks (для /zones/{id}/details)
# ------------------------------------------------------------
class ZoneWithTasks(Zone):
    tasks: List[Task] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Notifications
# ------------------------------------------------------------
class Notification(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime
    link: Optional[str] = None

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Documents
# ------------------------------------------------------------
class DocumentBase(BaseModel):
    title: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class Document(DocumentBase):
    id: int
    original_name: str
    mime_type: str
    size: int
    uploaded_at: datetime
    download_url: str

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Auth
# ------------------------------------------------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str

# --- НОВАЯ СХЕМА ---
class FirstPasswordChangeRequest(BaseModel):
    email: str
    temp_password: str
    new_password: constr(min_length=8) # Добавим минимальную валидацию длины


# ------------------------------------------------------------
# Схемы для аудита и логов
# ------------------------------------------------------------
class LoginEvent(BaseModel):
    id: int
    user_id: Optional[int] = None
    email: Optional[str] = None
    success: bool
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLog(BaseModel):
    id: int
    user: Optional[Pyrotechnician] = None
    action: str
    object_type: Optional[str] = None
    object_id: Optional[str] = None
    description: Optional[str] = None
    ip: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ------------------------------------------------------------
# Схемы для админских действий
# ------------------------------------------------------------
class AdminSetPasswordRequest(BaseModel):
    password: Optional[str] = None


class AdminSetPasswordResponse(BaseModel):
    password: str


# ------------------------------------------------------------
# model_rebuild для рекурсивных ссылок
# ------------------------------------------------------------
OrganizationUnit.model_rebuild()
Team.model_rebuild()
OrganizationNode.model_rebuild()
Task.model_rebuild()
TaskComment.model_rebuild()
Document.model_rebuild()
ZoneWithTasks.model_rebuild()
LoginEvent.model_rebuild()
AuditLog.model_rebuild()