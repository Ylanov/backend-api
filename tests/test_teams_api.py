# tests/test_teams_api.py
import asyncio

import pytest
from fastapi import HTTPException

from app.api import teams as teams_module
from app.schemas import TeamCreate


class DummyExecuteCountOne:
    """Результат execute(), у которого scalar_one() возвращает 1 (есть дубликат)."""

    def scalar_one(self):
        return 1


class DummySessionTeamConflict:
    """
    AsyncSession-заглушка для create_team:
    execute() говорит, что уже есть команда с таким именем.
    """

    async def execute(self, stmt):
        return DummyExecuteCountOne()

    def add(self, obj):
        raise AssertionError("add() не должен вызываться при конфликте имени")

    async def commit(self):
        raise AssertionError("commit() не должен вызываться при конфликте имени")


def test_create_team_conflict_by_name():
    """
    Если в подразделении уже есть команда с таким именем,
    create_team должен вернуть 409.
    """
    db = DummySessionTeamConflict()
    payload = TeamCreate(
        name="Alpha",
        lead_id=None,
        organization_unit_id=None,
        member_ids=[],
    )

    async def _call():
        await teams_module.create_team(payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 409
    assert "Team with this name already exists in this unit" in exc.value.detail


# ---- Тест для get_team (404) ----


class DummyScalarsNoTeam:
    def first(self):
        return None


class DummyResultNoRows:
    def scalars(self):
        return DummyScalarsNoTeam()


class DummySessionTeamNotFound:
    async def execute(self, stmt):
        return DummyResultNoRows()


def test_get_team_not_found_raises_404():
    """Проверяем, что get_team возвращает 404, если команда не найдена."""
    db = DummySessionTeamNotFound()

    async def _call():
        await teams_module.get_team(team_id=999, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Team not found"
