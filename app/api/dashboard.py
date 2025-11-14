# app/api/dashboard.py
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Task, Team, TaskStatus

router = APIRouter(
    prefix="/dashboard",  # Обратите внимание на префикс
    tags=["dashboard"],
)


class DashboardStats(BaseModel):
    """Схема для ответа со статистикой."""
    tasks_in_progress: int
    free_teams: int


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Эндпоинт для быстрой загрузки статистики для главной страницы.
    Считает цифры напрямую в базе данных, не загружая полные списки.
    """
    # 1. Считаем задачи в статусе "in_progress"
    tasks_stmt = select(func.count(Task.id)).where(
        Task.status == TaskStatus.IN_PROGRESS
    )
    tasks_in_progress_result = await db.execute(tasks_stmt)
    tasks_in_progress = tasks_in_progress_result.scalar_one_or_none() or 0

    # 2. Считаем свободные команды
    # Команда свободна, если на нее не назначено ни одной задачи в статусе 'in_progress'
    active_tasks_teams_subq = (
        select(Task.team_id)
        .where(Task.status == TaskStatus.IN_PROGRESS, Task.team_id.isnot(None))
        .distinct()
        .scalar_subquery()
    )

    free_teams_stmt = select(func.count(Team.id)).where(
        Team.id.not_in(active_tasks_teams_subq)
    )
    free_teams_result = await db.execute(free_teams_stmt)
    free_teams = free_teams_result.scalar_one_or_none() or 0

    return DashboardStats(
        tasks_in_progress=tasks_in_progress,
        free_teams=free_teams,
    )