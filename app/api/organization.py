# app/api/organization.py
from __future__ import annotations

from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import OrganizationUnit, Team
from app.schemas import (
    OrganizationUnit as UnitOut,
    OrganizationUnitCreate,
    OrganizationUnitUpdate,
    OrganizationNode,
)

router = APIRouter(
    prefix="/organization",
    tags=["organization"],
)


@router.get("/units", response_model=List[UnitOut])
async def list_units(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OrganizationUnit)
        .options(
            selectinload(OrganizationUnit.children),
            selectinload(OrganizationUnit.teams),
        )
        .order_by(OrganizationUnit.name)
    )
    return list(result.scalars().unique().all())


@router.post(
    "/units",
    response_model=UnitOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_unit(
    payload: OrganizationUnitCreate,
    db: AsyncSession = Depends(get_db),
):
    unit = OrganizationUnit(**payload.model_dump())
    db.add(unit)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Unit with this name already exists in this level",
        )
    await db.refresh(unit)
    return unit


@router.put("/units/{unit_id}", response_model=UnitOut)
async def update_unit(
    unit_id: int,
    payload: OrganizationUnitUpdate,
    db: AsyncSession = Depends(get_db),
):
    unit = await db.get(OrganizationUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    update_data = payload.model_dump()
    for key, value in update_data.items():
        setattr(unit, key, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Unit with this name already exists in this level",
        )

    await db.refresh(unit)
    return unit


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
):
    unit = await db.get(
        OrganizationUnit,
        unit_id,
        options=[selectinload(OrganizationUnit.children)],
    )
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    if unit.children:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete a unit with children. "
                "Please use cascade delete or delete them first."
            ),
        )

    await db.delete(unit)
    await db.commit()
    return None


async def _recursive_delete_unit(unit_id: int, db: AsyncSession) -> None:
    """Вспомогательная рекурсивная функция каскадного удаления подразделений."""
    unit_to_process = await db.get(
        OrganizationUnit,
        unit_id,
        options=[
            selectinload(OrganizationUnit.children),
            selectinload(OrganizationUnit.teams),
        ],
    )
    if not unit_to_process:
        return

    for child in unit_to_process.children:
        await _recursive_delete_unit(child.id, db)

    await db.delete(unit_to_process)


@router.delete("/units/{unit_id}/cascade", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit_cascade(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Каскадное удаление: удаляет указанное подразделение и ВСЕ вложенные в него
    подразделения, команды и связанные сущности.
    """
    await _recursive_delete_unit(unit_id, db)
    await db.commit()
    return None


@router.get("/structure", response_model=List[OrganizationNode])
async def get_organization_structure(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrganizationUnit)
        .options(
            selectinload(OrganizationUnit.teams).options(
                selectinload(Team.members),
                selectinload(Team.lead),
            )
        )
        .order_by(OrganizationUnit.name)
    )

    all_units = result.scalars().unique().all()
    unit_map = {u.id: u for u in all_units}
    node_map: Dict[int, OrganizationNode] = {}

    def build_node(unit: OrganizationUnit) -> OrganizationNode:
        if unit.id in node_map:
            return node_map[unit.id]

        team_nodes: List[OrganizationNode] = []
        # команды внутри подразделения
        for team in sorted(unit.teams, key=lambda t: t.name):
            member_nodes = [
                OrganizationNode(
                    id=f"pyro-{m.id}",
                    name=m.full_name,
                    description=m.role or "Сотрудник",
                    type="pyro",
                    children=[],
                )
                for m in sorted(team.members, key=lambda p: p.full_name)
            ]
            team_nodes.append(
                OrganizationNode(
                    id=f"team-{team.id}",
                    name=team.name,
                    description=(
                        "Руководитель: "
                        f"{team.lead.full_name if team.lead else 'не назначен'}"
                    ),
                    type="team",
                    children=member_nodes,
                )
            )

        node = OrganizationNode(
            id=f"unit-{unit.id}",
            name=unit.name,
            description=unit.description,
            type="unit",
            children=team_nodes,
        )
        node_map[unit.id] = node
        return node

    # создаём узлы для всех подразделений
    for unit in all_units:
        build_node(unit)

    root_nodes: List[OrganizationNode] = []
    for unit in all_units:
        node = node_map[unit.id]
        if unit.parent_id and unit.parent_id in node_map:
            parent_node = node_map[unit.parent_id]
            parent_node.children.append(node)
        else:
            root_nodes.append(node)

    # сортируем детей: сначала подразделения, потом остальные
    for node in node_map.values():
        node.children.sort(key=lambda x: (x.type != "unit", x.name))

    return sorted(root_nodes, key=lambda x: x.name)