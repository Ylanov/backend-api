from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Task
from app.schemas import (
    Task as TaskOut,
    TaskCreate,
    TaskUpdate,
)
from app.services.tasks import TASK_WITH_RELATIONS, patch_attachments_urls

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
)

# Константа для сообщения об отсутствии задачи
ERROR_TASK_NOT_FOUND = "Task not found"


@router.get("", response_model=List[TaskOut])
async def list_tasks(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    stmt = TASK_WITH_RELATIONS.order_by(Task.created_at.desc())
    result = await db.execute(stmt)
    tasks = result.scalars().unique().all()

    base_url = str(request.base_url)
    for task in tasks:
        patch_attachments_urls(task, base_url)

    return tasks


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    task = Task(**payload.model_dump())
    db.add(task)
    await db.commit()

    stmt = TASK_WITH_RELATIONS.where(Task.id == task.id)
    result = await db.execute(stmt)
    refreshed_task = result.scalars().unique().first()

    if not refreshed_task:
        # отдельное сообщение, не совпадает с ERROR_TASK_NOT_FOUND
        raise HTTPException(
            status_code=404,
            detail="Task not found after creation",
        )

    base_url = str(request.base_url)
    patch_attachments_urls(refreshed_task, base_url)

    return refreshed_task


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    stmt = TASK_WITH_RELATIONS.where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().unique().first()

    if not task:
        raise HTTPException(status_code=404, detail=ERROR_TASK_NOT_FOUND)

    base_url = str(request.base_url)
    patch_attachments_urls(task, base_url)

    return task


@router.put("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    base_stmt = TASK_WITH_RELATIONS.where(Task.id == task_id)
    result = await db.execute(base_stmt)
    task = result.scalars().unique().first()

    if not task:
        raise HTTPException(status_code=404, detail=ERROR_TASK_NOT_FOUND)

    update_data = payload.model_dump()
    for key, value in update_data.items():
        setattr(task, key, value)

    await db.commit()

    result = await db.execute(base_stmt)
    task = result.scalars().unique().one()

    base_url = str(request.base_url)
    patch_attachments_urls(task, base_url)

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=ERROR_TASK_NOT_FOUND)

    await db.delete(task)
    await db.commit()
    return None
