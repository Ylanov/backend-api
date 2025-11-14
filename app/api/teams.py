from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Team, Pyrotechnician
from app.schemas import (
    Team as TeamOut,
    TeamCreate,
    TeamUpdate,
    TeamPatch,
)

router = APIRouter(
    prefix="/teams",
    tags=["teams"],
)

# -------------------------------
# Константа для ошибки
# -------------------------------
ERROR_TEAM_NOT_FOUND = "Team not found"


@router.get("", response_model=List[TeamOut])
async def list_teams(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team)
        .options(
            selectinload(Team.members),
            selectinload(Team.lead),
        )
        .order_by(Team.name)
    )
    return list(result.scalars().unique().all())


@router.get("/{team_id}", response_model=TeamOut)
async def get_team(team_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team)
        .where(Team.id == team_id)
        .options(
            selectinload(Team.members),
            selectinload(Team.lead),
        )
    )
    team = result.scalars().first()
    if not team:
        raise HTTPException(status_code=404, detail=ERROR_TEAM_NOT_FOUND)
    return team


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
async def create_team(payload: TeamCreate, db: AsyncSession = Depends(get_db)):
    # проверка уникальности имени в рамках одного подразделения
    filters = [Team.name == payload.name]
    if payload.organization_unit_id is None:
        filters.append(Team.organization_unit_id.is_(None))
    else:
        filters.append(Team.organization_unit_id == payload.organization_unit_id)

    stmt = select(func.count()).select_from(Team).where(and_(*filters))
    if (await db.execute(stmt)).scalar_one():
        raise HTTPException(
            status_code=409,
            detail="Team with this name already exists in this unit",
        )

    team = Team(
        name=payload.name,
        lead_id=payload.lead_id,
        organization_unit_id=payload.organization_unit_id,
    )

    if payload.member_ids:
        members = (
            await db.execute(
                select(Pyrotechnician).where(
                    Pyrotechnician.id.in_(payload.member_ids)
                )
            )
        ).scalars().all()
        team.members = members

    db.add(team)
    await db.commit()
    await db.refresh(team)
    return team


@router.put("/{team_id}", response_model=TeamOut)
async def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: AsyncSession = Depends(get_db),
):
    team = await db.get(Team, team_id, options=[selectinload(Team.members)])
    if not team:
        raise HTTPException(status_code=404, detail=ERROR_TEAM_NOT_FOUND)

    # проверка уникальности имени в целевом подразделении
    filters = [Team.id != team_id, Team.name == payload.name]
    if payload.organization_unit_id is None:
        filters.append(Team.organization_unit_id.is_(None))
    else:
        filters.append(Team.organization_unit_id == payload.organization_unit_id)

    if (await db.execute(select(Team).where(and_(*filters)))).first():
        raise HTTPException(
            status_code=409,
            detail="Another team with this name already exists in the target unit",
        )

    team.name = payload.name
    team.lead_id = payload.lead_id
    team.organization_unit_id = payload.organization_unit_id

    if payload.member_ids:
        members = (
            await db.execute(
                select(Pyrotechnician).where(
                    Pyrotechnician.id.in_(payload.member_ids)
                )
            )
        ).scalars().all()
        team.members = members
    else:
        team.members = []

    await db.commit()
    await db.refresh(team)
    return team


@router.patch("/{team_id}", response_model=TeamOut)
async def patch_team(
    team_id: int,
    payload: TeamPatch,
    db: AsyncSession = Depends(get_db),
):
    team = await db.get(Team, team_id, options=[selectinload(Team.members)])
    if not team:
        raise HTTPException(status_code=404, detail=ERROR_TEAM_NOT_FOUND)

    update_data = payload.model_dump(exclude_unset=True)

    # если меняем имя или подразделение — проверяем уникальность
    if "name" in update_data or "organization_unit_id" in update_data:
        new_name = update_data.get("name", team.name)
        new_unit_id = update_data.get("organization_unit_id", team.organization_unit_id)

        filters = [Team.id != team_id, Team.name == new_name]
        if new_unit_id is None:
            filters.append(Team.organization_unit_id.is_(None))
        else:
            filters.append(Team.organization_unit_id == new_unit_id)

        if (await db.execute(select(Team).where(and_(*filters)))).first():
            raise HTTPException(
                status_code=409,
                detail="Another team with this name already exists in this unit",
            )

    for key, value in update_data.items():
        if key != "member_ids":
            setattr(team, key, value)

    if "member_ids" in update_data:
        if update_data["member_ids"]:
            members = (
                await db.execute(
                    select(Pyrotechnician).where(
                        Pyrotechnician.id.in_(update_data["member_ids"])
                    )
                )
            ).scalars().all()
            team.members = members
        else:
            team.members = []

    await db.commit()
    await db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(team_id: int, db: AsyncSession = Depends(get_db)):
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail=ERROR_TEAM_NOT_FOUND)

    await db.delete(team)
    await db.commit()
    return None
