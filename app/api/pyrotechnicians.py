from __future__ import annotations
import secrets
import string
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Pyrotechnician, pyrotechnician_team_association
from app.schemas import (
    Pyrotechnician as PyroOut,
    PyrotechnicianCreate,
    PyrotechnicianUpdate,
    AdminSetPasswordRequest,
    AdminSetPasswordResponse,
)
from app.security import get_current_admin, get_password_hash


router = APIRouter(
    prefix="/pyrotechnicians",
    tags=["pyrotechnicians"],
)

# -----------------------------------------
# 🔥 Константа для избежания дублирования
# -----------------------------------------
ERROR_PYRO_NOT_FOUND = "Pyrotechnician not found"


class BulkDeletePayload(BaseModel):
    ids: List[int] = Field(..., min_items=1)


class PyrotechnicianFlagsUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    must_change_password: Optional[bool] = None  # <-- новое поле


@router.get("", response_model=List[PyroOut])
async def list_pyrotechnicians(
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    result = await db.execute(
        select(Pyrotechnician).order_by(Pyrotechnician.full_name)
    )
    return result.scalars().all()


@router.post("", response_model=PyroOut, status_code=status.HTTP_201_CREATED)
async def create_pyrotechnician(
    payload: PyrotechnicianCreate,
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    q = select(Pyrotechnician).where(
        Pyrotechnician.full_name == payload.full_name
    )
    if (await db.execute(q)).first():
        raise HTTPException(
            status_code=409,
            detail=f"Pyrotechnician with name '{payload.full_name}' already exists",
        )

    entity = Pyrotechnician(**payload.model_dump())
    db.add(entity)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.get("/unassigned", response_model=List[PyroOut])
async def list_unassigned_pyrotechnicians(
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    subq = select(pyrotechnician_team_association.c.pyrotechnician_id).distinct()
    result = await db.execute(
        select(Pyrotechnician)
        .where(Pyrotechnician.id.not_in(subq))
        .order_by(Pyrotechnician.full_name)
    )
    return list(result.scalars().all())


@router.get("/{pyro_id}", response_model=PyroOut)
async def get_pyrotechnician(
    pyro_id: int,
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    pyro = await db.get(Pyrotechnician, pyro_id)
    if not pyro:
        raise HTTPException(status_code=404, detail=ERROR_PYRO_NOT_FOUND)
    return pyro


@router.put("/{pyro_id}", response_model=PyroOut)
async def update_pyrotechnician(
    pyro_id: int,
    payload: PyrotechnicianUpdate,
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    pyro = await db.get(Pyrotechnician, pyro_id)
    if not pyro:
        raise HTTPException(status_code=404, detail=ERROR_PYRO_NOT_FOUND)

    if payload.full_name != pyro.full_name:
        q = select(Pyrotechnician).where(
            Pyrotechnician.full_name == payload.full_name
        )
        if (await db.execute(q)).first():
            raise HTTPException(
                status_code=409,
                detail=f"Pyrotechnician with name '{payload.full_name}' already exists",
            )

    for key, value in payload.model_dump().items():
        setattr(pyro, key, value)

    await db.commit()
    await db.refresh(pyro)
    return pyro


@router.patch("/{pyro_id}/flags", response_model=PyroOut)
async def update_pyrotechnician_flags(
    pyro_id: int,
    payload: PyrotechnicianFlagsUpdate,
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    pyro = await db.get(Pyrotechnician, pyro_id)
    if not pyro:
        raise HTTPException(status_code=404, detail=ERROR_PYRO_NOT_FOUND)

    if pyro.id == current.id and payload.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя снять права администратора с самого себя.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "is_active" in update_data:
        pyro.is_active = update_data["is_active"]
    if "is_admin" in update_data:
        pyro.is_admin = update_data["is_admin"]
    if "must_change_password" in update_data:
        pyro.must_change_password = update_data["must_change_password"]

    db.add(pyro)
    await db.commit()
    await db.refresh(pyro)
    return pyro


@router.delete("/{pyro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pyrotechnician(
    pyro_id: int,
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    pyro = await db.get(Pyrotechnician, pyro_id)
    if not pyro:
        raise HTTPException(status_code=404, detail=ERROR_PYRO_NOT_FOUND)

    await db.delete(pyro)
    await db.commit()
    return None


@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_pyrotechnicians(
    payload: BulkDeletePayload,
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    if not payload.ids:
        return None

    result = await db.execute(
        select(Pyrotechnician).where(Pyrotechnician.id.in_(payload.ids))
    )
    entities = list(result.scalars().all())

    for e in entities:
        await db.delete(e)

    await db.commit()
    return None


@router.post(
    "/{pyro_id}/set-password",
    response_model=AdminSetPasswordResponse,
    status_code=status.HTTP_200_OK,
)
async def set_pyrotechnician_password(
    pyro_id: int,
    payload: AdminSetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current: Pyrotechnician = Depends(get_current_admin),
):
    pyro = await db.get(Pyrotechnician, pyro_id)
    if not pyro:
        raise HTTPException(status_code=404, detail="Пиротехник не найден")

    if payload.password:
        new_password = payload.password
    else:
        alphabet = string.ascii_letters + string.digits
        new_password = "".join(secrets.choice(alphabet) for _ in range(12))

    pyro.password_hash = get_password_hash(new_password)
    db.add(pyro)
    await db.commit()

    return AdminSetPasswordResponse(password=new_password)
