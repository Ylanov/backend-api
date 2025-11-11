# app/api/reports.py
from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from starlette.requests import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Task, TaskComment, TaskStatus, TaskPriority
from app.schemas import Task as TaskOut
from app.services.tasks import patch_attachments_urls

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
)


@router.get("/tasks", response_model=List[TaskOut])
async def get_tasks_report(
    request: Request,
    db: AsyncSession = Depends(get_db),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    team_id: Optional[int] = None,
    zone_id: Optional[int] = None,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
):
    stmt = (
        select(Task)
        .options(
            selectinload(Task.team),
            selectinload(Task.zone),
            selectinload(Task.comments).options(
                selectinload(TaskComment.author),
                selectinload(TaskComment.attachments),
            ),
        )
        .order_by(Task.created_at.desc())
    )

    if date_from:
        stmt = stmt.where(Task.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Task.created_at < (date_to + timedelta(days=1)))
    if team_id:
        stmt = stmt.where(Task.team_id == team_id)
    if zone_id:
        stmt = stmt.where(Task.zone_id == zone_id)
    if status:
        stmt = stmt.where(Task.status == status.value)
    if priority:
        stmt = stmt.where(Task.priority == priority.value)

    result = await db.execute(stmt)
    tasks = result.scalars().unique().all()

    base_url = str(request.base_url)
    for task in tasks:
        patch_attachments_urls(task, base_url)

    return tasks