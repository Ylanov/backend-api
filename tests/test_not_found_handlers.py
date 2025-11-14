# tests/test_not_found_handlers.py
import asyncio

import pytest
from fastapi import HTTPException

from app.api.tasks import delete_task
from app.api.teams import delete_team
from app.api.zones import get_zone_details
from app.api.pyrotechnicians import get_pyrotechnician
from app.models import Pyrotechnician


class DummyResultNoRows:
    """Результат db.execute(), у которого scalars().first() возвращает None."""

    class _Scalars:
        def first(self):
            return None

    def scalars(self):
        return self._Scalars()


class DummySessionAlwaysNone:
    """
    AsyncSession-заглушка:
    - get() всегда возвращает None (для delete_task/delete_team/get_pyrotechnician),
    - execute() возвращает объект, у которого scalars().first() == None
      (для get_zone_details).
    """

    async def get(self, model, pk):
        return None

    async def execute(self, *args, **kwargs):
        return DummyResultNoRows()

    async def delete(self, obj):
        # не должны сюда попасть, если get() возвращает None
        raise AssertionError("delete() should not be called when object is None")

    async def commit(self):
        raise AssertionError("commit() should not be called when object is None")


def test_delete_task_not_found_raises_404():
    async def _call():
        db = DummySessionAlwaysNone()
        await delete_task(task_id=123, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Task not found"


def test_delete_team_not_found_raises_404():
    async def _call():
        db = DummySessionAlwaysNone()
        await delete_team(team_id=321, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Team not found"


def test_get_zone_details_not_found_raises_404():
    async def _call():
        db = DummySessionAlwaysNone()
        await get_zone_details(zone_id=555, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Zone not found"


class DummyAdmin(Pyrotechnician):
    """Минимальный 'админ' для зависимостей get_current_admin."""
    is_admin = True


def test_get_pyrotechnician_not_found_raises_404():
    async def _call():
        db = DummySessionAlwaysNone()
        current = DummyAdmin()
        await get_pyrotechnician(pyro_id=999, db=db, current=current)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Pyrotechnician not found"
