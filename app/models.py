from __future__ import annotations
import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    UniqueConstraint,
    ForeignKey,
    Table,
    JSON,
    DateTime,
    Boolean,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# Берём Base из единого модуля database.py
from .database import Base


# --- КОНСТАНТЫ ДЛЯ FK И ON DELETE (убираем дубли строк) ---

PYROTECHNICIAN_FK_TARGET = "pyrotechnicians.id"
ONDELETE_SET_NULL = "SET NULL"


# --- ENUM-ТИПЫ ---

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


# --- СВЯЗЬ МНОГИЕ-КО-МНОГИМ ---

pyrotechnician_team_association = Table(
    "pyrotechnician_team_association",
    Base.metadata,
    Column(
        "pyrotechnician_id",
        ForeignKey(PYROTECHNICIAN_FK_TARGET, ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("team_id", ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
)


# --- МОДЕЛИ ---

class OrganizationUnit(Base):
    __tablename__ = "organization_units"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(
        Integer,
        ForeignKey("organization_units.id", ondelete="CASCADE"),
        nullable=True,
    )

    parent = relationship(
        "OrganizationUnit",
        remote_side=[id],
        back_populates="children",
        lazy="selectin",
    )
    children = relationship(
        "OrganizationUnit",
        back_populates="parent",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    teams = relationship(
        "Team",
        back_populates="organization_unit",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class Pyrotechnician(Base):
    __tablename__ = "pyrotechnicians"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False, unique=True, index=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    role = Column(String(255), nullable=True)
    rank = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)

    # --- Поля для безопасности и управления доступом ---
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )
    is_admin = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
    )
    token_version = Column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
    )

    # --- НОВОЕ ПОЛЕ: Требуется ли смена пароля при первом входе ---
    must_change_password = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # --- Поля для контроля входов ---
    last_login_at = Column(DateTime(timezone=True), nullable=True, index=True)
    login_count = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    teams = relationship(
        "Team",
        secondary=pyrotechnician_team_association,
        back_populates="members",
        lazy="selectin",
    )
    comments = relationship(
        "TaskComment",
        back_populates="author",
        lazy="selectin",
    )
    notifications = relationship(
        "Notification",
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("organization_unit_id", "name", name="uq_team_unit_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    lead_id = Column(
        Integer,
        ForeignKey(PYROTECHNICIAN_FK_TARGET, ondelete=ONDELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    organization_unit_id = Column(
        Integer,
        ForeignKey("organization_units.id", ondelete=ONDELETE_SET_NULL),
        nullable=True,
        index=True,
    )

    lead = relationship(
        "Pyrotechnician",
        foreign_keys=[lead_id],
        lazy="selectin",
    )
    organization_unit = relationship(
        "OrganizationUnit",
        back_populates="teams",
        lazy="selectin",
    )
    members = relationship(
        "Pyrotechnician",
        secondary=pyrotechnician_team_association,
        back_populates="teams",
        lazy="selectin",
    )
    tasks = relationship(
        "Task",
        back_populates="team",
        lazy="selectin",
    )


class Zone(Base):
    __tablename__ = "zones"
    __table_args__ = (
        UniqueConstraint("name", name="uq_zone_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    points = Column(JSON, nullable=False, default=list)
    description = Column(Text, nullable=True)

    tasks = relationship(
        "Task",
        back_populates="zone",
        lazy="selectin",
    )


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        String(50),
        nullable=False,
        index=True,
        default=TaskStatus.NEW.value,
    )
    priority = Column(
        String(50),
        nullable=False,
        index=True,
        default=TaskPriority.MEDIUM.value,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_onupdate=func.now())
    team_id = Column(
        Integer,
        ForeignKey("teams.id", ondelete=ONDELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    zone_id = Column(
        Integer,
        ForeignKey("zones.id", ondelete=ONDELETE_SET_NULL),
        nullable=True,
        index=True,
    )

    team = relationship(
        "Team",
        back_populates="tasks",
        lazy="selectin",
    )
    zone = relationship(
        "Zone",
        back_populates="tasks",
        lazy="selectin",
    )
    comments = relationship(
        "TaskComment",
        back_populates="task",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="TaskComment.created_at",
    )


class TaskComment(Base):
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    task_id = Column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(
        Integer,
        ForeignKey(PYROTECHNICIAN_FK_TARGET, ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    task = relationship(
        "Task",
        back_populates="comments",
        lazy="selectin",
    )
    author = relationship(
        "Pyrotechnician",
        back_populates="comments",
        lazy="selectin",
    )
    attachments = relationship(
        "TaskAttachment",
        back_populates="comment",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255), nullable=False)
    unique_name = Column(String(255), nullable=False, unique=True)
    mime_type = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    comment_id = Column(
        Integer,
        ForeignKey("task_comments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    comment = relationship(
        "TaskComment",
        back_populates="attachments",
        lazy="selectin",
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    link = Column(String(255), nullable=True)
    user_id = Column(
        Integer,
        ForeignKey(PYROTECHNICIAN_FK_TARGET, ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user = relationship(
        "Pyrotechnician",
        back_populates="notifications",
        lazy="selectin",
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    original_name = Column(String(255), nullable=False)
    unique_name = Column(String(255), nullable=False, unique=True)
    mime_type = Column(String(100), nullable=False)
    size = Column(Integer, nullable=False)
    tags = Column(JSON, nullable=False, default=list)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


# --- МОДЕЛИ ДЛЯ АУДИТА ---

class LoginEvent(Base):
    __tablename__ = "login_events"
    __table_args__ = (
        Index("ix_login_events_user_id_created_at", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey(PYROTECHNICIAN_FK_TARGET, ondelete=ONDELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    email = Column(String(255), nullable=True, index=True)
    success = Column(Boolean, nullable=False, index=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    user = relationship("Pyrotechnician", lazy="selectin")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_user_id_created_at", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey(PYROTECHNICIAN_FK_TARGET, ondelete=ONDELETE_SET_NULL),
        nullable=True,
        index=True,
    )
    action = Column(String(100), nullable=False, index=True)
    object_type = Column(String(50), nullable=True, index=True)
    object_id = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    ip = Column(String(64), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    user = relationship("Pyrotechnician", lazy="selectin")
