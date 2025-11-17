# tests/test_security_logic.py
import asyncio
from datetime import timedelta
from typing import Any, Optional

import pytest
from fastapi import HTTPException
from jose import jwt

from app import security as security_module
from app.models import Pyrotechnician

# ============================
# ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ
# ============================

class DummyPyro:
    """Простая заглушка для модели Pyrotechnician."""
    def __init__(
        self,
        pyro_id: int,
        is_active: bool = True,
        is_admin: bool = False,
        token_version: int = 1,
    ):
        self.id = pyro_id
        self.is_active = is_active
        self.is_admin = is_admin
        self.token_version = token_version


class DummyResult:
    """Эмуляция результата db.execute() для .scalars().first()."""
    def __init__(self, item: Optional[Any]):
        self._item = item

    def scalars(self):
        class _Scalars:
            def __init__(self, item):
                self._item = item
            def first(self):
                return self._item
        return _Scalars(self._item)


class DummySession:
    """Заглушка AsyncSession, которая может 'найти' одного пользователя."""
    def __init__(self, pyro: Optional[DummyPyro]):
        self._pyro = pyro

    async def execute(self, stmt: Any) -> DummyResult:
        # Мы не анализируем SQL, просто возвращаем подготовленного пользователя
        return DummyResult(self._pyro)


# ============================
# ТЕСТЫ ДЛЯ РАБОТЫ С ПАРОЛЯМИ
# ============================

def test_password_hashing_and_verification():
    """Проверяет, что хэширование и верификация пароля работают корректно."""
    password = "MySecurePassword123"
    password_hash = security_module.get_password_hash(password)

    # Хэш не должен быть равен исходному паролю
    assert password != password_hash
    # Верификация с правильным паролем должна вернуть True
    assert security_module.verify_password(password, password_hash) is True
    # Верификация с неправильным паролем должна вернуть False
    assert security_module.verify_password("wrong-password", password_hash) is False


def test_verify_password_handles_none_hash():
    """Проверяет, что верификация возвращает False, если хэш отсутствует."""
    assert security_module.verify_password("any-password", None) is False


# ============================
# ТЕСТЫ ДЛЯ JWT-ТОКЕНОВ
# ============================

def test_create_access_token_contains_expected_claims():
    """Проверяет состав JWT-токена."""
    token = security_module.create_access_token(
        subject=123,
        token_version=2,
        expires_delta=timedelta(minutes=5),
    )

    payload = jwt.decode(
        token,
        security_module.SECRET_KEY,
        algorithms=[security_module.ALGORITHM]
    )

    assert payload["sub"] == "123"
    assert payload["tv"] == 2
    assert "iat" in payload
    assert "exp" in payload


# ============================
# ТЕСТЫ ДЛЯ get_current_pyro
# ============================

@pytest.fixture
def valid_pyro() -> DummyPyro:
    """Фикстура, предоставляющая валидного, активного пользователя."""
    return DummyPyro(pyro_id=1, is_active=True, token_version=1)


def test_get_current_pyro_success(valid_pyro):
    """Проверяет успешное получение пользователя по валидному токену."""
    db = DummySession(pyro=valid_pyro)
    token = security_module.create_access_token(
        subject=valid_pyro.id, token_version=valid_pyro.token_version
    )

    async def _call():
        return await security_module.get_current_pyro(token=token, db=db)

    current_user = asyncio.run(_call())
    assert current_user is valid_pyro


@pytest.mark.parametrize(
    "bad_token",
    [
        "this-is-not-a-valid-token",  # Некорректный формат
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.gain_the_world", # Неверная подпись
    ],
)
def test_get_current_pyro_invalid_token_raises_401(bad_token):
    """Проверяет, что невалидный токен вызывает ошибку 401."""
    db = DummySession(pyro=None)
    async def _call():
        await security_module.get_current_pyro(token=bad_token, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 401
    assert "Не удалось проверить учетные данные" in exc.value.detail


def test_get_current_pyro_expired_token_raises_401():
    """Проверяет, что токен с истекшим сроком годности вызывает ошибку 401."""
    db = DummySession(pyro=None)
    expired_token = security_module.create_access_token(
        subject=1, token_version=1, expires_delta=timedelta(minutes=-5)
    )
    async def _call():
        await security_module.get_current_pyro(token=expired_token, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 401


def test_get_current_pyro_user_not_found_raises_401(valid_pyro):
    """Проверяет, что токен для несуществующего пользователя вызывает ошибку 401."""
    db = DummySession(pyro=None) # БД "не найдет" пользователя
    token = security_module.create_access_token(
        subject=valid_pyro.id, token_version=valid_pyro.token_version
    )
    async def _call():
        await security_module.get_current_pyro(token=token, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 401


def test_get_current_pyro_inactive_user_raises_403():
    """Проверяет, что токен для неактивного пользователя вызывает ошибку 403."""
    inactive_pyro = DummyPyro(pyro_id=1, is_active=False)
    db = DummySession(pyro=inactive_pyro)
    token = security_module.create_access_token(
        subject=inactive_pyro.id, token_version=inactive_pyro.token_version
    )
    async def _call():
        await security_module.get_current_pyro(token=token, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 403
    assert "Учетная запись деактивирована" in exc.value.detail


def test_get_current_pyro_wrong_token_version_raises_401(valid_pyro):
    """Проверяет, что токен со старой версией вызывает ошибку 401."""
    db = DummySession(pyro=valid_pyro) # У пользователя в БД версия 1
    old_token = security_module.create_access_token(
        subject=valid_pyro.id, token_version=0 # А в токене - 0
    )
    async def _call():
        await security_module.get_current_pyro(token=old_token, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 401


# ============================
# ТЕСТЫ ДЛЯ get_current_admin
# ============================

def test_get_current_admin_allows_admin():
    """Проверяет, что админ успешно проходит проверку."""
    admin_user = Pyrotechnician()
    admin_user.is_admin = True
    result = security_module.get_current_admin(current=admin_user)
    assert result is admin_user


def test_get_current_admin_forbidden_for_non_admin():
    """Проверяет, что обычный пользователь не проходит проверку и получает 403."""
    non_admin_user = Pyrotechnician()
    non_admin_user.is_admin = False

    with pytest.raises(HTTPException) as exc:
        security_module.get_current_admin(current=non_admin_user)

    assert exc.value.status_code == 403
    assert "Требуются права администратора" in exc.value.detail