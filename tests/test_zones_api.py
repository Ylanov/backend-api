# tests/test_zones_api.py
import asyncio
from typing import Any, List

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.api import zones as zones_module
from app.models import Zone, Task
# ИСПРАВЛЕНИЕ: Импортируем LatLngPoint вместо несуществующего Point
from app.schemas import ZoneCreate, ZoneUpdate, LatLngPoint


# ============================
# ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ
# ============================

class DummyZone:
    """Простая заглушка для модели SQLAlchemy Zone для использования в тестах."""
    def __init__(self, zone_id: int, name: str, description: str = "", points=None):
        self.id = zone_id
        self.name = name
        self.description = description
        self.points = points or []
        self.tasks: List[Task] = []  # Для get_zone_details


class DummyResult:
    """Эмуляция результата db.execute() для поддержки .scalars().all() и .first()."""
    def __init__(self, items: List[Any]):
        self._items = items

    def scalars(self):
        class _Scalars:
            def __init__(self, items):
                self._items = items
            def all(self):
                return list(self._items)
            def first(self):
                return self._items[0] if self._items else None
        return _Scalars(self._items)

    def first(self):
        return self._items[0] if self._items else None


class DummySession:
    """Универсальная заглушка AsyncSession для разных сценариев API зон."""
    def __init__(self, zones: List[DummyZone] | None = None):
        self._storage = {z.id: z for z in zones} if zones else {}
        self.added = []
        self.deleted = []
        self.committed = False
        self.rolled_back = False
        self._should_raise_integrity_error = False
        self._execute_result_items = []

    def set_integrity_error_on_commit(self, value: bool):
        self._should_raise_integrity_error = value

    def set_execute_result(self, items: List[Any]):
        self._execute_result_items = items

    def add(self, obj):
        self.added.append(obj)

    async def get(self, model, pk, **kwargs):
        return self._storage.get(pk)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def commit(self):
        if self._should_raise_integrity_error:
            raise IntegrityError(None, None, None)
        self.committed = True

    async def rollback(self):
        self.rolled_back = True

    async def refresh(self, obj):
        if not getattr(obj, "id", None):
            obj.id = 999
        pass

    async def execute(self, stmt):
        return DummyResult(self._execute_result_items)


# ============================
# ТЕСТЫ
# ============================

def test_list_zones_returns_all_zones():
    """Проверяем, что list_zones возвращает список зон из БД."""
    z1 = DummyZone(1, "Zone A")
    z2 = DummyZone(2, "Zone B")
    db = DummySession()
    db.set_execute_result([z1, z2])

    async def _call():
        return await zones_module.list_zones(db=db)

    result = asyncio.run(_call())
    assert result == [z1, z2]


def test_create_zone_success():
    """Проверяем успешное создание зоны со всеми полями."""
    db = DummySession()
    payload = ZoneCreate(
        name="New Zone",
        description="A cool new zone",
        # ИСПРАВЛЕНИЕ: Используем LatLngPoint
        points=[LatLngPoint(lat=1.0, lng=2.0)]
    )

    async def _call():
        return await zones_module.create_zone(payload=payload, db=db)

    zone = asyncio.run(_call())

    assert len(db.added) == 1
    created_zone = db.added[0]
    assert isinstance(created_zone, Zone)
    assert created_zone.name == "New Zone"
    assert created_zone.points == [{"lat": 1.0, "lng": 2.0}]
    assert db.committed is True
    assert zone is created_zone


def test_create_zone_conflict_raises_409():
    """Проверяем, что при конфликте имен (IntegrityError) возвращается 409."""
    db = DummySession()
    db.set_integrity_error_on_commit(True)
    payload = ZoneCreate(name="Existing Zone", description="", points=[])

    async def _call():
        await zones_module.create_zone(payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 409
    assert "already exists" in exc.value.detail
    assert db.rolled_back is True
    assert db.committed is False


def test_update_zone_not_found_raises_404():
    """Проверяем 404 при обновлении несуществующей зоны."""
    db = DummySession()
    payload = ZoneUpdate(name="any", description="", points=[])

    async def _call():
        await zones_module.update_zone(zone_id=123, payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == zones_module.ERROR_ZONE_NOT_FOUND


def test_update_zone_conflict_on_new_name_raises_409():
    """Проверяем 409, если новое имя зоны уже занято другой зоной."""
    zone_to_update = DummyZone(1, "Old Name")
    other_zone = DummyZone(2, "New Name")
    db = DummySession(zones=[zone_to_update, other_zone])
    db.set_execute_result([other_zone])

    payload = ZoneUpdate(name="New Name", description="", points=[])

    async def _call():
        await zones_module.update_zone(zone_id=1, payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 409
    assert "already exists" in exc.value.detail
    assert db.committed is False


def test_update_zone_success():
    """Проверяем успешное обновление всех полей зоны."""
    zone = DummyZone(1, "Old Name", "Old desc", [])
    db = DummySession(zones=[zone])
    db.set_execute_result([])

    payload = ZoneUpdate(
        name="New Name",
        description="New desc",
        # ИСПРАВЛЕНИЕ: Используем LatLngPoint
        points=[LatLngPoint(lat=5.0, lng=5.0)]
    )

    async def _call():
        return await zones_module.update_zone(zone_id=1, payload=payload, db=db)

    updated_zone = asyncio.run(_call())

    assert db.committed is True
    assert updated_zone.name == "New Name"
    assert updated_zone.description == "New desc"
    assert updated_zone.points == [{"lat": 5.0, "lng": 5.0}]


def test_delete_zone_not_found_raises_404():
    """Проверяем 404 при удалении несуществующей зоны."""
    db = DummySession()

    async def _call():
        await zones_module.delete_zone(zone_id=123, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == zones_module.ERROR_ZONE_NOT_FOUND


def test_delete_zone_success():
    """Проверяем успешное удаление существующей зоны."""
    zone = DummyZone(1, "To Delete")
    db = DummySession(zones=[zone])

    async def _call():
        await zones_module.delete_zone(zone_id=1, db=db)

    asyncio.run(_call())

    assert len(db.deleted) == 1
    assert db.deleted[0] is zone
    assert db.committed is True


def test_get_zone_details_not_found_raises_404():
    """Проверяем 404, если запрашиваемой для деталей зоны не существует."""
    db = DummySession()
    db.set_execute_result([])

    async def _call():
        await zones_module.get_zone_details(zone_id=404, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == zones_module.ERROR_ZONE_NOT_FOUND


def test_get_zone_details_success():
    """Проверяем успешное получение деталей зоны (включая связанные задачи)."""
    zone = DummyZone(1, "Detailed Zone")
    zone.tasks = [Task(id=101, title="Task in zone")]
    db = DummySession()
    db.set_execute_result([zone])

    async def _call():
        return await zones_module.get_zone_details(zone_id=1, db=db)

    result = asyncio.run(_call())

    assert result is zone
    assert result.name == "Detailed Zone"
    assert len(result.tasks) == 1
    assert result.tasks[0].title == "Task in zone"