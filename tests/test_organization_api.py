# tests/test_organization_api.py
import asyncio
from typing import List

import pytest
from fastapi import HTTPException

from app.api import organization as org_module
from app.models import OrganizationUnit, Team  # noqa: F401


# --- Вспомогательные классы для имитации результата db.execute() ---


class _DummyScalars:
    def __init__(self, items):
        self._items = list(items)

    def unique(self):
        return self

    def all(self):
        return list(self._items)


class DummyResult:
    def __init__(self, items):
        self._items = list(items)

    def scalars(self):
        return _DummyScalars(self._items)


# ============================
#   ТЕСТЫ ДЛЯ delete_unit
# ============================


class DummySessionDeleteNotFound:
    async def get(self, model, obj_id, options=None):
        return None


class DummyUnit:
    def __init__(self, unit_id: int, name: str = "Unit", children=None):
        self.id = unit_id
        self.name = name
        self.children = list(children or [])
        self.teams: List[Team] = []


class DummySessionDeleteWithChildren:
    def __init__(self):
        self._unit = DummyUnit(1, children=[DummyUnit(2)])

    async def get(self, model, obj_id, options=None):
        return self._unit

    async def delete(self, obj):
        raise AssertionError("delete() не должен вызываться, когда есть children")

    async def commit(self):
        raise AssertionError("commit() не должен вызываться, когда есть children")


class DummySessionDeleteSuccess:
    def __init__(self):
        self.unit = DummyUnit(1, children=[])
        self.deleted = None
        self.committed = False

    async def get(self, model, obj_id, options=None):
        return self.unit

    async def delete(self, obj):
        self.deleted = obj

    async def commit(self):
        self.committed = True


def test_delete_unit_not_found_raises_404():
    async def _call():
        await org_module.delete_unit(unit_id=123, db=DummySessionDeleteNotFound())

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert "unit not found" in str(exc.value.detail).lower()


def test_delete_unit_with_children_raises_400():
    async def _call():
        await org_module.delete_unit(unit_id=1, db=DummySessionDeleteWithChildren())

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    # проверяем реальное сообщение из кода
    detail = str(exc.value.detail).lower()
    assert "cannot delete a unit with children" in detail


def test_delete_unit_success_deletes_and_commits():
    db = DummySessionDeleteSuccess()

    async def _call():
        await org_module.delete_unit(unit_id=1, db=db)

    asyncio.run(_call())

    assert db.deleted is db.unit
    assert db.committed is True


# ==============================================
#   ТЕСТЫ ДЛЯ _recursive_delete_unit и cascade
# ==============================================


class DummyRecursiveUnit:
    def __init__(self, unit_id: int, children=None):
        self.id = unit_id
        self.children: list[DummyRecursiveUnit] = list(children or [])
        self.teams: list[Team] = []


class DummySessionRecursive:
    def __init__(self, unit_map):
        # unit_map: id -> DummyRecursiveUnit
        self.unit_map = dict(unit_map)
        self.deleted_ids: list[int] = []
        self.committed = False

    async def get(self, model, obj_id, options=None):
        return self.unit_map.get(obj_id)

    async def delete(self, unit):
        self.deleted_ids.append(unit.id)

    async def commit(self):
        self.committed = True


def test_recursive_delete_unit_no_unit__no_deletes():
    db = DummySessionRecursive(unit_map={})

    async def _call():
        await org_module._recursive_delete_unit(unit_id=999, db=db)

    asyncio.run(_call())

    assert db.deleted_ids == []


def test_recursive_delete_unit_deletes_tree_depth_first():
    # дерево: root(1) -> child(2) -> grandchild(3)
    grandchild = DummyRecursiveUnit(3)
    child = DummyRecursiveUnit(2, children=[grandchild])
    root = DummyRecursiveUnit(1, children=[child])

    db = DummySessionRecursive({1: root, 2: child, 3: grandchild})

    async def _call():
        await org_module._recursive_delete_unit(unit_id=1, db=db)

    asyncio.run(_call())

    # сначала 3, потом 2, потом 1
    assert db.deleted_ids == [3, 2, 1]


def test_delete_unit_cascade_calls_recursive_and_commit():
    root = DummyRecursiveUnit(1)
    db = DummySessionRecursive({1: root})

    async def _call():
        await org_module.delete_unit_cascade(unit_id=1, db=db)

    asyncio.run(_call())

    # _recursive_delete_unit уже покрыт, здесь проверяем, что вызвался и commit
    assert db.deleted_ids == [1]
    assert db.committed is True


# ==========================================
#   ТЕСТ ДЛЯ get_organization_structure
# ==========================================


class DummyPyro:
    def __init__(self, pyro_id: int, full_name: str):
        self.id = pyro_id
        self.full_name = full_name
        self.role = "pyro"


class DummyTeam:
    def __init__(self, team_id: int, name: str, members=None, lead=None):
        self.id = team_id
        self.name = name
        self.members: list[DummyPyro] = list(members or [])
        self.lead = lead


class DummyOrgUnit:
    def __init__(self, unit_id: int, name: str, description: str, parent_id=None, teams=None):
        self.id = unit_id
        self.name = name
        self.description = description
        self.parent_id = parent_id
        self.teams: list[DummyTeam] = list(teams or [])


class DummySessionStructure:
    def __init__(self, units):
        self._units = list(units)

    async def execute(self, stmt):
        # stmt нам не важен, возвращаем подготовленный список юнитов
        return DummyResult(self._units)


def test_get_organization_structure_builds_hierarchy_with_units_and_teams():
    # root unit с дочерним подразделением и командами
    lead = DummyPyro(1, "Lead User")
    member1 = DummyPyro(2, "Member A")
    member2 = DummyPyro(3, "Member B")

    team_root = DummyTeam(10, "Root Team", members=[member1, member2], lead=lead)
    team_child = DummyTeam(11, "Child Team", members=[member1], lead=None)

    root_unit = DummyOrgUnit(1, "Root Unit", "Root description", parent_id=None, teams=[team_root])
    child_unit = DummyOrgUnit(2, "Child Unit", "Child description", parent_id=1, teams=[team_child])

    db = DummySessionStructure([root_unit, child_unit])

    async def _call():
        return await org_module.get_organization_structure(db=db)

    nodes = asyncio.run(_call())

    # Должен быть один корневой узел — Root Unit
    assert len(nodes) == 1
    root_node = nodes[0]
    assert root_node.name == "Root Unit"
    assert root_node.type == "unit"

    # Среди детей root должны быть и подразделения, и команды
    child_types = {child.type for child in root_node.children}
    assert "unit" in child_types
    assert "team" in child_types

    # Проверяем, что у команды корректно распакованы участники
    team_nodes = [child for child in root_node.children if child.type == "team"]
    assert team_nodes, "ожидали хотя бы одну команду у корневого узла"
    members_names = [m.name for m in team_nodes[0].children]
    assert "Member A" in members_names
    assert "Member B" in members_names
