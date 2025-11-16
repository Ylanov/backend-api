import asyncio
from datetime import datetime, timezone
from typing import List, Optional

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api import auth as auth_module
from app.schemas import LoginRequest, FirstPasswordChangeRequest, Token


# ---------------- Вспомогательные сущности -----------------


class DummyPyro:
    """Простая заглушка пользователя, достаточно полей, которые читает auth.py."""

    def __init__(
        self,
        pyro_id: int,
        email: str,
        password_hash: str = "hash",
        is_active: bool = True,
        must_change_password: bool = False,
        token_version: int = 1,
        last_login_at: Optional[datetime] = None,
        login_count: Optional[int] = 0,
        full_name: Optional[str] = None,
    ):
        self.id = pyro_id
        self.email = email
        self.password_hash = password_hash
        self.is_active = is_active
        self.must_change_password = must_change_password
        self.token_version = token_version
        self.last_login_at = last_login_at
        self.login_count = login_count
        # для текста аудита в invalidate_user_tokens
        self.full_name = full_name or email


class _DummyScalars:
    def __init__(self, items: List[DummyPyro]):
        self._items = list(items)

    def first(self):
        return self._items[0] if self._items else None


class DummyResult:
    def __init__(self, items: List[DummyPyro]):
        self._items = list(items)

    def scalars(self):
        return _DummyScalars(self._items)


# --------- Dummy-сессии для разных сценариев ---------


class DummySessionLoginSuccess:
    def __init__(self, pyro: DummyPyro):
        self.pyro = pyro
        self.added: list = []
        self.committed = False

    async def execute(self, stmt):
        # stmt нам не важен, всегда возвращаем одного пользователя
        return DummyResult([self.pyro])

    # В реальном AsyncSession add синхронный, поэтому тут тоже sync
    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


class DummySessionLoginEmpty:
    async def execute(self, stmt):
        # Пользователь не найден
        return DummyResult([])


class DummySessionGetById:
    """Заглушка для invalidate_user_tokens, где используется get и add/commit."""

    def __init__(self, pyro: Optional[DummyPyro]):
        self.pyro = pyro
        self.added: list = []
        self.committed = False

    async def get(self, model, obj_id, options=None):
        return self.pyro

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


class DummySessionNoop:
    """Минимальная заглушка для logout_all, нужен только add/commit."""

    def __init__(self):
        self.added: list = []
        self.committed = False

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


# ---------------- Общие заглушки для логов и токенов -----------------


@pytest.fixture
def stub_logging_and_tokens(monkeypatch):
    async def _log_login_event(db, request, pyro, email, success):
        return None

    async def _log_audit(db, request, user, action, object_type, object_id, description):
        return None

    def _create_token(subject, token_version):
        return f"TOKEN-{subject}-{token_version}"

    monkeypatch.setattr(auth_module, "log_login_event", _log_login_event)
    monkeypatch.setattr(auth_module, "log_audit", _log_audit)
    monkeypatch.setattr(auth_module, "create_access_token", _create_token)


# ======================= ТЕСТЫ /login =======================


def test_login_success(monkeypatch, stub_logging_and_tokens):
    pyro = DummyPyro(pyro_id=1, email="user@example.com")
    db = DummySessionLoginSuccess(pyro)
    request = MagicMock()

    # пароль корректный
    monkeypatch.setattr(auth_module, "verify_password", lambda raw, hashed: True)

    async def _call():
        return await auth_module.login(
            data=LoginRequest(email="user@example.com", password="secret"),
            request=request,
            db=db,
        )

    token = asyncio.run(_call())
    assert isinstance(token, Token)
    assert token.access_token.startswith("TOKEN-1-")

    # проверяем, что обновились last_login_at и login_count и был commit
    assert pyro.last_login_at is not None
    assert pyro.last_login_at.tzinfo is timezone.utc
    assert pyro.login_count == 1
    assert db.committed is True


def test_login_wrong_password_raises_401(monkeypatch, stub_logging_and_tokens):
    pyro = DummyPyro(pyro_id=1, email="user@example.com")
    db = DummySessionLoginSuccess(pyro)
    request = MagicMock()

    # пароль неверный
    monkeypatch.setattr(auth_module, "verify_password", lambda raw, hashed: False)

    async def _call():
        await auth_module.login(
            data=LoginRequest(email="user@example.com", password="bad"),
            request=request,
            db=db,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 401
    assert "Неверный логин" in str(exc.value.detail)


def test_login_must_change_password_returns_403(monkeypatch, stub_logging_and_tokens):
    pyro = DummyPyro(
        pyro_id=1,
        email="user@example.com",
        must_change_password=True,
    )
    db = DummySessionLoginSuccess(pyro)
    request = MagicMock()

    monkeypatch.setattr(auth_module, "verify_password", lambda raw, hashed: True)

    async def _call():
        await auth_module.login(
            data=LoginRequest(email="user@example.com", password="secret"),
            request=request,
            db=db,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 403
    assert exc.value.detail == "PASSWORD_CHANGE_REQUIRED"


def test_login_user_not_found_raises_401(monkeypatch, stub_logging_and_tokens):
    db = DummySessionLoginEmpty()
    request = MagicMock()
    monkeypatch.setattr(auth_module, "verify_password", lambda raw, hashed: True)

    async def _call():
        await auth_module.login(
            data=LoginRequest(email="nope@example.com", password="secret"),
            request=request,
            db=db,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 401


# ==================== ТЕСТЫ /first-change-password ====================


def test_first_change_password_success(monkeypatch, stub_logging_and_tokens):
    pyro = DummyPyro(
        pyro_id=1,
        email="user@example.com",
        must_change_password=True,
        password_hash="temp_hash",
    )
    db = DummySessionLoginSuccess(pyro)
    request = MagicMock()

    # временный пароль совпадает
    monkeypatch.setattr(auth_module, "verify_password", lambda raw, hashed: True)
    monkeypatch.setattr(auth_module, "get_password_hash", lambda pwd: f"hashed-{pwd}")

    async def _call():
        return await auth_module.first_change_password(
            data=FirstPasswordChangeRequest(
                email="user@example.com",
                temp_password="temp",
                new_password="new-secret",
            ),
            request=request,
            db=db,
        )

    token = asyncio.run(_call())

    assert pyro.must_change_password is False
    assert pyro.password_hash == "hashed-new-secret"
    assert pyro.login_count == 1
    assert isinstance(token, Token)
    assert token.access_token.startswith("TOKEN-1-")


def test_first_change_password_wrong_temp_password(monkeypatch, stub_logging_and_tokens):
    pyro = DummyPyro(
        pyro_id=1,
        email="user@example.com",
        must_change_password=True,
        password_hash="temp_hash",
    )
    db = DummySessionLoginSuccess(pyro)
    request = MagicMock()

    # временный пароль НЕ совпадает
    monkeypatch.setattr(auth_module, "verify_password", lambda raw, hashed: False)
    monkeypatch.setattr(auth_module, "get_password_hash", lambda pwd: f"hashed-{pwd}")

    async def _call():
        await auth_module.first_change_password(
            data=FirstPasswordChangeRequest(
                email="user@example.com",
                temp_password="bad",
                new_password="new-secret",
            ),
            request=request,
            db=db,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    assert "Неверный временный пароль" in str(exc.value.detail)


def test_first_change_password_not_required(monkeypatch, stub_logging_and_tokens):
    pyro = DummyPyro(
        pyro_id=1,
        email="user@example.com",
        must_change_password=False,
        password_hash="hash",
    )
    db = DummySessionLoginSuccess(pyro)
    request = MagicMock()

    monkeypatch.setattr(auth_module, "verify_password", lambda raw, hashed: True)

    async def _call():
        await auth_module.first_change_password(
            data=FirstPasswordChangeRequest(
                email="user@example.com",
                temp_password="temp",
                new_password="new-secret",
            ),
            request=request,
            db=db,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    assert "Смена пароля не требуется" in str(exc.value.detail)


# ==================== /me, /logout_all, /invalidate_tokens ====================


def test_get_me_returns_current_user():
    pyro = DummyPyro(pyro_id=1, email="user@example.com")

    async def _call():
        return await auth_module.get_me(current=pyro)

    result = asyncio.run(_call())
    assert result is pyro


def test_logout_all_increments_token_version_and_logs(stub_logging_and_tokens):
    pyro = DummyPyro(pyro_id=1, email="user@example.com", token_version=3)
    db = DummySessionNoop()
    request = MagicMock()

    async def _call():
        await auth_module.logout_all(request=request, db=db, current=pyro)

    asyncio.run(_call())

    assert pyro.token_version == 4
    assert db.committed is True
    assert db.added[0] is pyro


def test_invalidate_user_tokens_not_found_404(stub_logging_and_tokens):
    db = DummySessionGetById(pyro=None)
    request = MagicMock()
    admin = DummyPyro(pyro_id=999, email="admin@example.com")

    async def _call():
        await auth_module.invalidate_user_tokens(
            pyro_id=1,
            request=request,
            db=db,
            admin=admin,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404


def test_invalidate_user_tokens_success(stub_logging_and_tokens):
    pyro = DummyPyro(pyro_id=1, email="user@example.com", token_version=2)
    db = DummySessionGetById(pyro=pyro)
    request = MagicMock()
    admin = DummyPyro(pyro_id=999, email="admin@example.com", full_name="Admin User")

    async def _call():
        await auth_module.invalidate_user_tokens(
            pyro_id=1,
            request=request,
            db=db,
            admin=admin,
        )

    asyncio.run(_call())

    assert pyro.token_version == 3
    assert db.committed is True
    assert db.added[0] is pyro
