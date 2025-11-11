# app/api/logs.py
from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import LoginEvent, AuditLog, Pyrotechnician
from app.schemas import LoginEvent as LoginEventOut, AuditLog as AuditLogOut
from app.security import get_current_admin

# Используем префикс /api/admin для всех админских эндпоинтов
router = APIRouter(prefix="/admin", tags=["admin-logs"])


@router.get("/login-events", response_model=List[LoginEventOut])
async def list_login_events(
    db: AsyncSession = Depends(get_db),
    _: Pyrotechnician = Depends(get_current_admin), # Только для админов
    user_id: Optional[int] = Query(None, description="Фильтр по ID пользователя"),
    success: Optional[bool] = Query(None, description="Фильтр по статусу входа"),
    limit: int = Query(100, ge=1, le=500, description="Кол-во записей на странице"),
    offset: int = Query(0, ge=0, description="Смещение"),
):
    """Получение журнала событий входа."""
    stmt = select(LoginEvent).order_by(LoginEvent.created_at.desc())
    if user_id is not None:
        stmt = stmt.where(LoginEvent.user_id == user_id)
    if success is not None:
        stmt = stmt.where(LoginEvent.success == success)
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/audit-logs", response_model=List[AuditLogOut])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    _: Pyrotechnician = Depends(get_current_admin), # Только для админов
    user_id: Optional[int] = Query(None, description="Фильтр по ID пользователя"),
    action: Optional[str] = Query(None, description="Фильтр по названию действия"),
    object_type: Optional[str] = Query(None, description="Фильтр по типу объекта"),
    date_from: Optional[date] = Query(None, description="Дата начала периода"),
    date_to: Optional[date] = Query(None, description="Дата окончания периода"),
    limit: int = Query(100, ge=1, le=500, description="Кол-во записей на странице"),
    offset: int = Query(0, ge=0, description="Смещение"),
):
    """Получение журнала аудита действий."""
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if object_type:
        stmt = stmt.where(AuditLog.object_type == object_type)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AuditLog.created_at < (date_to + timedelta(days=1)))
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    return list(result.scalars().all())