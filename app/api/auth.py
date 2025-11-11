# app/api/auth.py
from __future__ import annotations
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Pyrotechnician
from app.schemas import (
    Token,
    LoginRequest,
    Pyrotechnician as PyrotechnicianOut,
    FirstPasswordChangeRequest,  # <-- Новый импорт
)
from app.security import (
    verify_password,
    create_access_token,
    get_current_pyro,
    get_current_admin,
    get_password_hash,  # <-- Новый импорт
)
from app.services.audit import log_login_event, log_audit

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.post("/login", response_model=Token)
async def login(
        data: LoginRequest,
        request: Request,
        db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pyrotechnician).where(Pyrotechnician.email == data.email)
    )
    pyro = result.scalars().first()

    if not pyro or not pyro.password_hash:
        await log_login_event(db, request=request, pyro=None, email=data.email, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    if not verify_password(data.password, pyro.password_hash):
        await log_login_event(db, request=request, pyro=pyro, email=pyro.email, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    if not pyro.is_active:
        await log_login_event(db, request=request, pyro=pyro, email=pyro.email, success=False)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учетная запись деактивирована. Обратитесь к администратору.",
        )

    # --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ---
    # Если требуется смена пароля, не пускаем, а возвращаем специальный код
    if pyro.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PASSWORD_CHANGE_REQUIRED",
        )
    # ---------------------------

    # Обновляем дату последнего входа и счетчик
    pyro.last_login_at = datetime.now(timezone.utc)
    pyro.login_count = (pyro.login_count or 0) + 1
    db.add(pyro)
    await db.commit()

    await log_login_event(db, request=request, pyro=pyro, email=pyro.email, success=True)

    access_token = create_access_token(
        subject=pyro.id,
        token_version=pyro.token_version,
    )
    return Token(access_token=access_token)


# --- НОВЫЙ ЭНДПОИНТ ---
@router.post("/first-change-password", response_model=Token)
async def first_change_password(
        data: FirstPasswordChangeRequest,
        request: Request,
        db: AsyncSession = Depends(get_db),
):
    """
    Обрабатывает первую смену пароля пользователя.
    """
    result = await db.execute(
        select(Pyrotechnician).where(Pyrotechnician.email == data.email)
    )
    pyro = result.scalars().first()

    if not pyro or not pyro.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Неверные учетные данные"
        )

    if not pyro.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Смена пароля не требуется или уже выполнена",
        )

    if not pyro.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован"
        )

    if not verify_password(data.temp_password, pyro.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный временный пароль"
        )

    # Устанавливаем новый пароль и снимаем флаг
    pyro.password_hash = get_password_hash(data.new_password)
    pyro.must_change_password = False

    # Также обновляем информацию о входе, так как это действие его заменяет
    pyro.last_login_at = datetime.now(timezone.utc)
    pyro.login_count = (pyro.login_count or 0) + 1

    db.add(pyro)
    await db.commit()

    # Логируем как успешный вход
    await log_login_event(db, request=request, pyro=pyro, email=pyro.email, success=True)

    # Сразу выдаём токен
    access_token = create_access_token(
        subject=pyro.id,
        token_version=pyro.token_version,
    )
    return Token(access_token=access_token)


@router.get("/me", response_model=PyrotechnicianOut)
async def get_me(current: Pyrotechnician = Depends(get_current_pyro)):
    return current


@router.post("/logout_all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current: Pyrotechnician = Depends(get_current_pyro),
):
    current.token_version += 1
    db.add(current)
    await db.commit()

    await log_audit(
        db,
        request=request,
        user=current,
        action="auth.logout_all",
        object_type="pyrotechnician",
        object_id=current.id,
        description="Пользователь вышел со всех устройств.",
    )
    return None


@router.post(
    "/users/{pyro_id}/invalidate_tokens",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def invalidate_user_tokens(
        pyro_id: int,
        request: Request,
        db: AsyncSession = Depends(get_db),
        admin: Pyrotechnician = Depends(get_current_admin),
):
    pyro = await db.get(Pyrotechnician, pyro_id)
    if not pyro:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    pyro.token_version += 1
    db.add(pyro)
    await db.commit()

    await log_audit(
        db,
        request=request,
        user=admin,
        action="auth.invalidate_tokens",
        object_type="pyrotechnician",
        object_id=pyro.id,
        description=f"Администратор сбросил сессии пользователя '{pyro.full_name}' (ID: {pyro.id}).",
    )
    return None