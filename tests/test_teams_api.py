# tests/test_teams_api.py
import asyncio

import pytest
from fastapi import HTTPException

from app.api import teams as teams_module
from app.models import Team, Pyrotechnician
from app.schemas import TeamCreate, TeamPatch


# ============================
#  create_team: конфликт по имени
# ============================

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


# ============================
#  get_team: 404, если команды нет
# ============================

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
    assert exc.value.detail == teams_module.ERROR_TEAM_NOT_FOUND


# ============================
#  patch_team: конфликт уникальности
# ============================

class DummyResultFirstSomething:
    """execute().first() возвращает не-None → есть конфликт имени."""

    def first(self):
        return object()


class DummySessionPatchConflict:
    """
    Для patch_team: get() возвращает существующую команду,
    а execute().first() → не-None, чтобы сработал 409.
    """

    def __init__(self):
        self._team = Team(
            id=1,
            name="Old Name",
            lead_id=None,
            organization_unit_id=10,
        )
        self._team.members = []

    async def get(self, model, pk, **kwargs):
        # kwargs принимает options=[selectinload(...)] и т.п.
        assert model is Team
        assert pk == 1
        return self._team

    async def execute(self, stmt):
        # это вызов проверки уникальности:
        # select(Team).where(and_(...)).first()
        return DummyResultFirstSomething()

    async def commit(self):
        raise AssertionError("commit() не должен вызываться при конфликте")

    async def refresh(self, obj):
        raise AssertionError("refresh() не должен вызываться при конфликте")


def test_patch_team_conflict_by_name_in_unit():
    """
    Если при частичном обновлении (patch_team) новое имя уже занято
    в том же подразделении, должен быть 409 и соответствующее сообщение.
    """
    db = DummySessionPatchConflict()
    payload = TeamPatch(
        name="New Name",
        organization_unit_id=10,
    )

    async def _call():
        await teams_module.patch_team(team_id=1, payload=payload, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 409
    assert "Another team with this name already exists in this unit" in exc.value.detail


# ============================
#  patch_team: очистка member_ids
# ============================

class DummySessionPatchClearMembers:
    """
    Для patch_team: изменяем только member_ids -> []
    Должна сработать ветка:
        if "member_ids" in update_data:
            ...
            else:
                team.members = []
    """

    def __init__(self):
        self.team = Team(
            id=1,
            name="Team A",
            lead_id=None,
            organization_unit_id=20,
        )
        # имитируем, что у команды уже есть участники
        self.team.members = [Pyrotechnician(id=1), Pyrotechnician(id=2)]
        self.committed = False

    async def get(self, model, pk, **kwargs):
        # kwargs принимает options=[selectinload(...)]
        assert model is Team
        assert pk == 1
        return self.team

    async def execute(self, stmt):
        # В этом тесте мы не меняем name / organization_unit_id,
        # поэтому блок проверки уникальности вызываться не должен.
        raise AssertionError("execute() не должен вызываться при patch только member_ids")

    async def commit(self):
        self.committed = True

    async def refresh(self, obj):
        # ничего не делаем — нам важно только состояние team.members
        pass


def test_patch_team_clear_members():
    """
    При передаче member_ids = [] через TeamPatch
    у команды должны очиститься участники и зафиксироваться изменения.
    """
    db = DummySessionPatchClearMembers()
    payload = TeamPatch(member_ids=[])

    async def _call():
        return await teams_module.patch_team(team_id=1, payload=payload, db=db)

    updated = asyncio.run(_call())

    # Все участники должны быть удалены
    assert updated.members == []
    assert db.team.members == []
    # и транзакция зафиксирована
    assert db.committed is True
