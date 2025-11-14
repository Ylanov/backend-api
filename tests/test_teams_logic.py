# tests/test_teams_logic.py
import asyncio
from typing import List, Optional

import pytest
from fastapi import HTTPException

from app.api import teams as teams_module
from app.models import Pyrotechnician, Team
from app.schemas import TeamCreate, TeamUpdate, TeamPatch


class MockTeamQueryResult:
    def __init__(self, result: Optional[Team] = None):
        self._result = result

    def first(self):
        return self._result

    def scalar_one(self):
        return 1 if self._result else 0


class DummySessionForTeams:
    """Заглушка AsyncSession для тестирования логики эндпоинтов /teams."""

    def __init__(self):
        self.committed = False
        self.deleted = False
        self.refreshed = False
        self._storage = {}  # Простое хранилище {модель: {id: объект}}
        self._execute_result = None

    def set_execute_result(self, result: Optional[Team] = None):
        self._execute_result = MockTeamQueryResult(result)

    async def get(self, model, pk, options=None):
        return self._storage.get(model, {}).get(pk)

    def add(self, obj):
        if Team not in self._storage:
            self._storage[Team] = {}
        # Симулируем автоинкремент
        new_id = len(self._storage[Team]) + 1
        obj.id = new_id
        self._storage[Team][new_id] = obj

    async def delete(self, obj):
        if self._storage.get(Team, {}).get(obj.id):
            del self._storage[Team][obj.id]
            self.deleted = True

    async def commit(self):
        self.committed = True

    async def refresh(self, obj):
        self.refreshed = True

    async def execute(self, stmt):
        return self._execute_result


@pytest.mark.asyncio
async def test_create_team_conflict():
    """Проверяем ошибку 409 при создании команды с неуникальным именем."""
    db = DummySessionForTeams()
    # Симулируем, что в базе уже есть команда с таким именем
    db.set_execute_result(Team(id=2, name="Existing Team"))

    payload = TeamCreate(name="Existing Team", organization_unit_id=1)

    with pytest.raises(HTTPException) as exc:
        await teams_module.create_team(payload=payload, db=db)

    assert exc.value.status_code == 409
    assert "already exists" in exc.value.detail


@pytest.mark.asyncio
async def test_update_team_not_found():
    """Проверяем ошибку 404 при обновлении несуществующей команды."""
    db = DummySessionForTeams()
    payload = TeamUpdate(name="New Name")

    with pytest.raises(HTTPException) as exc:
        await teams_module.update_team(team_id=999, payload=payload, db=db)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Team not found"


@pytest.mark.asyncio
async def test_patch_team_conflict():
    """Проверяем ошибку 409 при частичном обновлении, приводящем к конфликту имен."""
    db = DummySessionForTeams()
    # В "базе" есть команда, которую мы пытаемся обновить
    existing_team = Team(id=1, name="Old Name", organization_unit_id=1)
    db._storage[Team] = {1: existing_team}

    # И симулируем, что другая команда с целевым именем уже существует
    db.set_execute_result(Team(id=2, name="New Conflicting Name"))

    payload = TeamPatch(name="New Conflicting Name")

    with pytest.raises(HTTPException) as exc:
        await teams_module.patch_team(team_id=1, payload=payload, db=db)

    assert exc.value.status_code == 409
    assert "already exists" in exc.value.detail


@pytest.mark.asyncio
async def test_delete_team_success():
    """Проверяем успешное удаление команды."""
    db = DummySessionForTeams()
    team_to_delete = Team(id=1, name="Team to Delete")
    db._storage[Team] = {1: team_to_delete}

    await teams_module.delete_team(team_id=1, db=db)

    assert 1 not in db._storage[Team]
    assert db.deleted is True
    assert db.committed is True