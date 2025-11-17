# tests/test_teams_api.py
import asyncio
from typing import List, Any, Optional

import pytest
from fastapi import HTTPException

from app.api import teams as teams_module
from app.models import Team, Pyrotechnician  # <-- Используем реальные модели
from app.schemas import TeamCreate, TeamUpdate, TeamPatch


# ============================
# ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ
# ============================

class DummyResult:
    """Универсальная эмуляция результата db.execute()."""
    def __init__(self, items: List[Any]):
        self._items = items

    def scalars(self):
        class _Scalars:
            def __init__(self, items):
                self._items = items
            def all(self): return list(self._items)
            def unique(self): return self
            def first(self): return self._items[0] if self._items else None
        return _Scalars(self._items)

    def first(self):
        return self._items[0] if self._items else None

    def scalar_one(self):
        # Для проверки func.count()
        if len(self._items) == 1 and isinstance(self._items[0], int):
            return self._items[0]
        raise ValueError("scalar_one() expected a single integer result.")


class DummySession:
    """Универсальная заглушка AsyncSession для API команд."""
    def __init__(self):
        self._storage: dict[int, Team] = {} # <-- Храним реальные Team
        self._execute_queue: List[DummyResult] = []
        self.added: List[Any] = []
        self.deleted: List[Any] = []
        self.committed = False

    def seed(self, teams: List[Team]):
        self._storage = {t.id: t for t in teams}

    def expect_execute(self, result_items: List[Any]):
        self._execute_queue.append(DummyResult(result_items))

    async def get(self, model, pk, **kwargs):
        return self._storage.get(pk)

    async def execute(self, stmt):
        if not self._execute_queue:
            raise AssertionError(f"Unexpected call to db.execute() with statement: {stmt}")
        return self._execute_queue.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def commit(self):
        self.committed = True

    async def refresh(self, obj):
        if isinstance(obj, Team) and not obj.id:
            obj.id = 999
        # Присваиваем отношения вручную, т.к. refresh в SQLAlchemy делает это
        if hasattr(obj, 'members'):
            pass # В реальной жизни тут бы подгрузились участники
        pass

# ============================
# ТЕСТЫ
# ============================

def test_list_teams_success():
    """Проверяет успешное получение списка всех команд."""
    db = DummySession()
    t1 = Team(id=1, name="Alpha")
    t2 = Team(id=2, name="Bravo")
    db.expect_execute([t1, t2])

    async def _call():
        return await teams_module.list_teams(db=db)

    result = asyncio.run(_call())
    assert len(result) == 2
    assert result[0] is t1

def test_get_team_not_found_raises_404():
    """Проверяет 404, если команда не найдена."""
    db = DummySession()
    db.expect_execute([])

    async def _call():
        await teams_module.get_team(team_id=999, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 404

def test_get_team_success():
    """Проверяет успешное получение одной команды."""
    db = DummySession()
    team = Team(id=1, name="Alpha")
    db.expect_execute([team])

    async def _call():
        return await teams_module.get_team(team_id=1, db=db)

    result = asyncio.run(_call())
    assert result is team

def test_create_team_conflict_by_name_raises_409():
    """Проверяет 409 при попытке создать команду с уже существующим именем в юните."""
    db = DummySession()
    db.expect_execute([1])
    payload = TeamCreate(name="Alpha", organization_unit_id=1)

    async def _call():
        await teams_module.create_team(payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 409
    assert "already exists in this unit" in exc.value.detail

def test_create_team_success_with_members():
    """Проверяет успешное создание команды с участниками."""
    db = DummySession()
    db.expect_execute([0]) # func.count() -> нет конфликта
    pyro1 = Pyrotechnician(id=10, full_name="John Doe") # <-- Используем реальную модель
    pyro2 = Pyrotechnician(id=11, full_name="Jane Smith")
    db.expect_execute([pyro1, pyro2])

    payload = TeamCreate(name="Alpha", organization_unit_id=1, member_ids=[10, 11])

    async def _call():
        return await teams_module.create_team(payload=payload, db=db)

    new_team = asyncio.run(_call())

    assert len(db.added) == 1
    assert db.committed is True
    assert new_team.name == "Alpha"
    assert len(new_team.members) == 2
    assert new_team.members[0].full_name == "John Doe"

def test_update_team_not_found_raises_404():
    """Проверяет 404 при обновлении несуществующей команды."""
    db = DummySession()
    payload = TeamUpdate(name="any", member_ids=[])

    async def _call():
        await teams_module.update_team(team_id=1, payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 404

def test_update_team_conflict_in_target_unit_raises_409():
    """Проверяет 409, если новое имя команды уже занято в целевом юните."""
    db = DummySession()
    team_to_update = Team(id=1, name="Old Name", organization_unit_id=1)
    db.seed([team_to_update])
    db.expect_execute([Team(id=2, name="New Name", organization_unit_id=2)])

    payload = TeamUpdate(name="New Name", organization_unit_id=2, member_ids=[])

    async def _call():
        await teams_module.update_team(team_id=1, payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 409

def test_update_team_success_clears_and_adds_members():
    """Проверяет успешное обновление команды, включая смену участников."""
    db = DummySession()
    existing_team = Team(id=1, name="Alpha", organization_unit_id=1)
    existing_team.members = [Pyrotechnician(id=10, full_name="Old Member")]
    db.seed([existing_team])
    db.expect_execute([])
    new_member = Pyrotechnician(id=11, full_name="New Member")
    db.expect_execute([new_member])

    payload = TeamUpdate(name="Alpha V2", organization_unit_id=1, member_ids=[11])

    async def _call():
        return await teams_module.update_team(team_id=1, payload=payload, db=db)

    updated_team = asyncio.run(_call())

    assert db.committed is True
    assert updated_team.name == "Alpha V2"
    assert len(updated_team.members) == 1
    assert updated_team.members[0].full_name == "New Member"

def test_patch_team_success_updates_subset_of_fields():
    """Проверяет успешное частичное обновление полей команды."""
    db = DummySession()
    existing_team = Team(id=1, name="Alpha", organization_unit_id=1)
    existing_team.members = [Pyrotechnician(id=10, full_name="Member")]
    db.seed([existing_team])
    # Т.к. member_ids=[], execute будет вызван для получения (пустого) списка участников
    db.expect_execute([])

    payload = TeamPatch(lead_id=10, member_ids=[])

    async def _call():
        return await teams_module.patch_team(team_id=1, payload=payload, db=db)

    updated_team = asyncio.run(_call())

    assert db.committed is True
    assert updated_team.lead_id == 10
    assert updated_team.members == []
    assert updated_team.name == "Alpha"

def test_delete_team_not_found_raises_404():
    """Проверяет 404 при удалении несуществующей команды."""
    db = DummySession()

    async def _call():
        await teams_module.delete_team(team_id=999, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 404

def test_delete_team_success():
    """Проверяет успешное удаление команды."""
    db = DummySession()
    team_to_delete = Team(id=1, name="ToDelete")
    db.seed([team_to_delete])

    async def _call():
        await teams_module.delete_team(team_id=1, db=db)

    asyncio.run(_call())

    assert len(db.deleted) == 1
    assert db.deleted[0] is team_to_delete
    assert db.committed is True