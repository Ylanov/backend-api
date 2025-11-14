# tests/test_tasks_logic.py
import asyncio
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api import tasks as tasks_module
from app.models import Task
from app.schemas import TaskCreate, TaskUpdate


class MockScalars:
    def __init__(self, task=None):
        self._task = task

    def unique(self):
        return self

    def first(self):
        return self._task

    def one(self):
        if not self._task:
            raise Exception("No row was found for one()")
        return self._task

    def all(self):
        return [self._task] if self._task else []


class DummySessionForTasks:
    """Заглушка AsyncSession для тестирования логики эндпоинтов /tasks."""

    def __init__(self):
        self.committed = False
        self.deleted = False
        self._execute_result = None
        self._storage = {}

    def set_execute_result(self, task=None):
        self._execute_result = MagicMock(scalars=lambda: MockScalars(task))

    def add(self, obj):
        if isinstance(obj, Task):
            obj.id = 1
            self._storage[1] = obj
            # После добавления execute должен найти эту задачу
            self.set_execute_result(obj)

    async def commit(self):
        self.committed = True

    async def execute(self, stmt):
        return self._execute_result

    async def get(self, model, pk):
        return self._storage.get(pk)

    async def delete(self, obj):
        if obj.id in self._storage:
            del self._storage[obj.id]
            self.deleted = True


@pytest.fixture
def mock_request():
    """Фикстура для создания мока Request с base_url."""
    req = MagicMock()
    req.base_url = "http://testserver/"
    return req


def test_create_task_success(mock_request):
    """
    Проверяем успешное создание задачи:
    - задача возвращается с id,
    - транзакция зафиксирована.
    """
    db = DummySessionForTasks()
    payload = TaskCreate(title="Test Task")

    async def _call():
        return await tasks_module.create_task(
            payload=payload,
            request=mock_request,
            db=db,
        )

    created = asyncio.run(_call())

    assert isinstance(created, Task)
    assert created.id == 1
    assert created.title == "Test Task"
    assert db.committed is True


def test_update_task_not_found(mock_request):
    """Проверяем ошибку 404 при обновлении несуществующей задачи."""
    db = DummySessionForTasks()
    db.set_execute_result(task=None)  # execute вернет None
    payload = TaskUpdate(title="New Title")

    async def _call():
        await tasks_module.update_task(
            task_id=999, payload=payload, request=mock_request, db=db
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Task not found"


def test_delete_task_success():
    """Проверяем успешное удаление задачи."""
    task_to_delete = Task(id=1, title="Initial title")
    db = DummySessionForTasks()
    db._storage = {1: task_to_delete}  # Помещаем задачу в хранилище

    async def _call():
        await tasks_module.delete_task(task_id=1, db=db)

    asyncio.run(_call())

    assert 1 not in db._storage
    assert db.deleted is True
    assert db.committed is True
