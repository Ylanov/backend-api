# app/security.py
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from .database import get_db
from .models import Pyrotechnician

# ===============================
# Конфигурация JWT / паролей
# ===============================

SECRET_KEY = settings.SECRET_KEY.get_secret_value()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

if not SECRET_KEY or SECRET_KEY == "CHANGE_ME_IN_PRODUCTION":
    import warnings
    warnings.warn(
        "SECRET_KEY не задан или использует значение по умолчанию. "
        "В production ОБЯЗАТЕЛЬНО установите переменную окружения SECRET_KEY "
        "в длинную случайную строку.",
        RuntimeWarning,
    )

# ===============================
# КЛЮЧЕВАЯ СТРОКА: Убедитесь, что она выглядит именно так
# ===============================
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ===============================
# Работа с паролями
# ===============================

def verify_password(plain_password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return pwd_context.verify(plain_password, password_hash)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ===============================
# JWT-токены
# ===============================

def create_access_token(
    *,
    subject: int | str,
    token_version: int,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Создаём JWT access token с версией."""
    now = datetime.utcnow()
    expire = now + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode = {
        "sub": str(subject),
        "tv": int(token_version), # Версия токена
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ===============================
# Зависимости FastAPI
# ===============================

async def get_current_pyro(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Pyrotechnician:
    """
    Достаём текущего пиротехника из JWT-токена,
    проверяя версию токена для возможности сброса сессий.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        token_version = payload.get("tv") # Извлекаем версию
        if sub is None or token_version is None:
            raise credentials_exception
        user_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    result = await db.execute(
        select(Pyrotechnician).where(Pyrotechnician.id == user_id)
    )
    pyro = result.scalars().first()

    if pyro is None:
        raise credentials_exception

    if not pyro.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учетная запись деактивирована.",
        )

    # Ключевая проверка для сброса сессий
    if pyro.token_version != int(token_version):
        raise credentials_exception

    return pyro


async def get_current_admin(
    current: Pyrotechnician = Depends(get_current_pyro),
) -> Pyrotechnician:
    """
    Зависимость, которая требует, чтобы текущий пользователь был администратором.
    """
    if not current.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора",
        )
    return current