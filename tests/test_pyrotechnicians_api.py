# tests/test_pyrotechnicians_api.py
import asyncio
from typing import List

import pytest
from fastapi import HTTPException

from app.api import pyrotechnicians as pyros_module
from app.api.pyrotechnicians import (
    PyrotechnicianFlagsUpdate,
    BulkDeletePayload,
)
from app.models import Pyrotechnician
from app.schemas import (
    PyrotechnicianCreate,
    PyrotechnicianUpdate,
    Pyrotechnician as PyroOut,
    AdminSetPasswordRequest,
)


# --- Вспомогательные классы -------------------------------------------------


class DummyPyro:
    def __init__(
        self,
        pyro_id: int = 1,
        full_name: str = "User",
        email: str = "user@example.com",
        is_active: bool = True,
        is_admin: bool = False,
        must_change_password: bool = False,
    ):
        self.id = pyro_id
        self.full_name = full_name
        self.email = email
        self.is_active = is_active
        self.is_admin = is_admin
        self.must_change_password = must_change_password
        self.password_hash = "hashed"
        self.token_version = 1


class DummyResult:
    """Эмулирует результат db.execute()."""

    def __init__(self, rows: List[Pyrotechnician]):
        self._rows = rows

    def scalars(self):
        class _Scalars:
            def __init__(self, rows):
                self._rows = rows

            def all(self):
                return list(self._rows)

            def first(self):
                return self._rows[0] if self._rows else None

        return _Scalars(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


# --- list/get/update --------------------------------------------------------


class DummySessionGetNone:
    async def get(self, model, pk, **kwargs):  # noqa: ARG002
        return None


class DummySessionGetPyro:
    def __init__(self, pyro):
        self._pyro = pyro

    async def get(self, model, pk, **kwargs):  # noqa: ARG002
        return self._pyro


class DummySessionUpdateConflict:
    """get -> pyro, execute -> есть дубликат имени."""

    def __init__(self, pyro):
        self._pyro = pyro

    async def get(self, model, pk, **kwargs):  # noqa: ARG002
        return self._pyro

    async def execute(self, stmt):  # noqa: ARG002
        # first() не None => конфликт
        return DummyResult([self._pyro])

    async def commit(self):
        pass

    async def refresh(self, instance):  # noqa: ARG002
        pass


class DummySessionUpdateOK:
    """get -> pyro, execute -> дубликатов нет, фиксируем обновление."""

    def __init__(self, pyro):
        self._pyro = pyro
        self.committed = False
        self.refreshed = False

    async def get(self, model, pk, **kwargs):  # noqa: ARG002
        return self._pyro

    async def execute(self, stmt):  # noqa: ARG002
        # пустой список => нет дубликатов
        return DummyResult([])

    async def commit(self):
        self.committed = True

    async def refresh(self, instance):  # noqa: ARG002
        self.refreshed = True


# --- flags / delete / bulk-delete ------------------------------------------


class DummySessionFlags(DummySessionGetPyro):
    def __init__(self, pyro):
        super().__init__(pyro)
        self.committed = False

    async def add(self, instance):  # noqa: ARG002
        # AsyncSession.add в реальности sync, но await'а нет — для флага commit нам не важно
        pass

    async def commit(self):
        self.committed = True

    async def refresh(self, instance):  # noqa: ARG002
        pass


class DummySessionDelete:
    def __init__(self, pyro):
        self._pyro = pyro
        self.deleted = []
        self.committed = False

    async def get(self, model, pk, **kwargs):  # noqa: ARG002
        return self._pyro

    async def delete(self, instance):
        self.deleted.append(instance)

    async def commit(self):
        self.committed = True


class DummySessionBulkWithEntities:
    def __init__(self, entities):
        self._entities = entities
        self.deleted = []
        self.committed = False

    async def execute(self, stmt):  # noqa: ARG002
        return DummyResult(self._entities)

    async def delete(self, instance):
        self.deleted.append(instance)

    async def commit(self):
        self.committed = True


# --- set-password -----------------------------------------------------------


class DummySessionSetPassword:
    def __init__(self, pyro: DummyPyro | None):
        self._pyro = pyro
        self.added = []
        self.committed = False

    async def get(self, model, pk, **kwargs):  # noqa: ARG002
        return self._pyro

    # Важно: add синхронный, как у настоящего AsyncSession.add
    def add(self, instance):
        self.added.append(instance)

    async def commit(self):
        self.committed = True


# ====================== ТЕСТЫ ===============================================


def test_get_pyrotechnician_not_found_raises_404():
    async def _call():
        await pyros_module.get_pyrotechnician(
            pyro_id=123,
            db=DummySessionGetNone(),
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == pyros_module.ERROR_PYRO_NOT_FOUND


def test_get_pyrotechnician_returns_entity():
    pyro = DummyPyro(pyro_id=1, full_name="Test User")
    db = DummySessionGetPyro(pyro)

    async def _call():
        return await pyros_module.get_pyrotechnician(
            pyro_id=1,
            db=db,
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    result = asyncio.run(_call())
    assert result is pyro


def test_update_pyrotechnician_conflict_on_name_raises_409():
    pyro = DummyPyro(pyro_id=1, full_name="Old Name")
    db = DummySessionUpdateConflict(pyro)

    payload = PyrotechnicianUpdate(
        full_name="New Name",
        email="new@example.com",
        phone=None,
        role=None,
        rank=None,
        password=None,
    )

    async def _call():
        await pyros_module.update_pyrotechnician(
            pyro_id=1,
            payload=payload,
            db=db,
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 409
    assert "already exists" in exc.value.detail


def test_update_pyrotechnician_updates_fields_and_commits():
    pyro = DummyPyro(pyro_id=1, full_name="Old", email="old@example.com")
    db = DummySessionUpdateOK(pyro)

    payload = PyrotechnicianUpdate(
        full_name="New Name",
        email="new@example.com",
        phone="123",
        role="Role",
        rank="Rank",
        password=None,
    )

    async def _call():
        return await pyros_module.update_pyrotechnician(
            pyro_id=1,
            payload=payload,
            db=db,
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    updated = asyncio.run(_call())

    assert updated is pyro
    assert pyro.full_name == "New Name"
    assert pyro.email == "new@example.com"
    assert pyro.phone == "123"
    assert pyro.role == "Role"
    assert pyro.rank == "Rank"
    # is_active и is_admin не меняются этим эндпоинтом
    assert db.committed is True
    assert db.refreshed is True


def test_update_pyrotechnician_flags_cannot_remove_own_admin():
    current = DummyPyro(pyro_id=1, is_admin=True)
    db = DummySessionFlags(current)

    payload = PyrotechnicianFlagsUpdate(is_admin=False)

    async def _call():
        await pyros_module.update_pyrotechnician_flags(
            pyro_id=1,
            payload=payload,
            db=db,
            current=current,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    assert "Нельзя снять права администратора" in exc.value.detail


def test_update_pyrotechnician_flags_updates_all_flags():
    pyro = DummyPyro(
        pyro_id=1,
        is_active=False,
        is_admin=False,
        must_change_password=True,
    )
    current_admin = DummyPyro(pyro_id=999, is_admin=True)
    db = DummySessionFlags(pyro)

    payload = PyrotechnicianFlagsUpdate(
        is_active=True,
        is_admin=True,
        must_change_password=False,
    )

    async def _call():
        return await pyros_module.update_pyrotechnician_flags(
            pyro_id=1,
            payload=payload,
            db=db,
            current=current_admin,
        )

    updated = asyncio.run(_call())

    assert updated is pyro
    assert pyro.is_active is True
    assert pyro.is_admin is True
    assert pyro.must_change_password is False
    assert db.committed is True


def test_delete_pyrotechnician_not_found_raises_404():
    db = DummySessionDelete(pyro=None)
    current_admin = DummyPyro(pyro_id=999, is_admin=True)

    async def _call():
        await pyros_module.delete_pyrotechnician(
            pyro_id=1,
            db=db,
            current=current_admin,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == pyros_module.ERROR_PYRO_NOT_FOUND


def test_delete_pyrotechnician_success():
    pyro = DummyPyro(pyro_id=1)
    db = DummySessionDelete(pyro)
    current_admin = DummyPyro(pyro_id=999, is_admin=True)

    async def _call():
        await pyros_module.delete_pyrotechnician(
            pyro_id=1,
            db=db,
            current=current_admin,
        )

    asyncio.run(_call())

    assert db.deleted == [pyro]
    assert db.committed is True


def test_bulk_delete_deletes_all_found_entities():
    p1 = DummyPyro(pyro_id=1)
    p2 = DummyPyro(pyro_id=2)
    entities = [p1, p2]
    db = DummySessionBulkWithEntities(entities)

    payload = BulkDeletePayload(ids=[1, 2])

    async def _call():
        return await pyros_module.bulk_delete_pyrotechnicians(
            payload=payload,
            db=db,
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    result = asyncio.run(_call())

    assert result is None
    assert db.deleted == entities
    assert db.committed is True


def test_set_pyrotechnician_password_not_found_raises_404():
    db = DummySessionSetPassword(pyro=None)

    payload = AdminSetPasswordRequest(password="NewPassword123")

    async def _call():
        await pyros_module.set_pyrotechnician_password(
            pyro_id=1,
            payload=payload,
            db=db,
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert "Пиротехник не найден" in exc.value.detail


def test_set_pyrotechnician_password_with_explicit_password(monkeypatch):
    pyro = DummyPyro(pyro_id=1)
    db = DummySessionSetPassword(pyro)

    captured = {}

    def fake_hash(pwd: str) -> str:
        captured["pwd"] = pwd
        return f"HASH({pwd})"

    monkeypatch.setattr(pyros_module, "get_password_hash", fake_hash)

    payload = AdminSetPasswordRequest(password="MySecret123")

    async def _call():
        return await pyros_module.set_pyrotechnician_password(
            pyro_id=1,
            payload=payload,
            db=db,
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    resp = asyncio.run(_call())

    assert resp.password == "MySecret123"
    assert captured["pwd"] == "MySecret123"
    assert pyro.password_hash == "HASH(MySecret123)"
    assert db.committed is True
    assert db.added == [pyro]


def test_set_pyrotechnician_password_generates_random_when_not_provided(monkeypatch):
    pyro = DummyPyro(pyro_id=1)
    db = DummySessionSetPassword(pyro)

    # фиксируем генерацию, чтобы тест был детерминированным
    seq = list("ABCDEF123456")

    def fake_choice(alphabet: str) -> str:  # noqa: ARG001
        return seq.pop(0)

    def fake_hash(pwd: str) -> str:
        return f"HASH(pwd=" + pwd + ")"

    monkeypatch.setattr(pyros_module.secrets, "choice", fake_choice)
    monkeypatch.setattr(pyros_module, "get_password_hash", fake_hash)

    payload = AdminSetPasswordRequest(password=None)

    async def _call():
        return await pyros_module.set_pyrotechnician_password(
            pyro_id=1,
            payload=payload,
            db=db,
            current=DummyPyro(pyro_id=999, is_admin=True),
        )

    resp = asyncio.run(_call())

    # ожидаем нашу "случайную" строку длиной 12
    assert resp.password == "ABCDEF123456"
    assert pyro.password_hash == "HASH(pwd=ABCDEF123456)"
    assert db.committed is True
    assert db.added == [pyro]
