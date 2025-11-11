# app/api/notifications.py
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Notification, Pyrotechnician
from app.schemas import Notification as NotificationOut
from app.security import get_current_pyro

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
)


@router.get("", response_model=List[NotificationOut])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_pyro: Pyrotechnician = Depends(get_current_pyro),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_pyro.id)
        .order_by(Notification.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_pyro: Pyrotechnician = Depends(get_current_pyro),
):
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != current_pyro.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification
