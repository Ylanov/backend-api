from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Zone, Task
from app.schemas import (
    Zone as ZoneOut,
    ZoneCreate,
    ZoneUpdate,
    ZoneWithTasks,
)

router = APIRouter(
    prefix="/zones",
    tags=["zones"],
)

# -------------------------
# Константа ошибки
# -------------------------
ERROR_ZONE_NOT_FOUND = "Zone not found"


@router.get("", response_model=List[ZoneOut])
async def list_zones(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Zone).order_by(Zone.name))
    return list(result.scalars().all())


@router.post("", response_model=ZoneOut, status_code=status.HTTP_201_CREATED)
async def create_zone(
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
):
    zone = Zone(
        name=payload.name,
        description=payload.description,
        points=[p.model_dump() for p in payload.points],
    )
    db.add(zone)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Zone with this name already exists",
        )
    await db.refresh(zone)
    return zone


@router.put("/{zone_id}", response_model=ZoneOut)
async def update_zone(
    zone_id: int,
    payload: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
):
    zone = await db.get(Zone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=ERROR_ZONE_NOT_FOUND)

    if payload.name != zone.name:
        q = select(Zone).where(Zone.name == payload.name)
        if (await db.execute(q)).first():
            raise HTTPException(
                status_code=409,
                detail=f"Zone with name '{payload.name}' already exists",
            )

    zone.name = payload.name
    zone.description = payload.description
    zone.points = [p.model_dump() for p in payload.points]

    await db.commit()
    await db.refresh(zone)
    return zone


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: int,
    db: AsyncSession = Depends(get_db),
):
    zone = await db.get(Zone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=ERROR_ZONE_NOT_FOUND)

    await db.delete(zone)
    await db.commit()
    return None


@router.get("/{zone_id}/details", response_model=ZoneWithTasks)
async def get_zone_details(
    zone_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Zone)
        .where(Zone.id == zone_id)
        .options(selectinload(Zone.tasks).selectinload(Task.team))
    )
    zone = result.scalars().first()
    if not zone:
        raise HTTPException(status_code=404, detail=ERROR_ZONE_NOT_FOUND)
    return zone
