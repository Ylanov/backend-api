# tests/test_tasks_logic.py
import asyncio
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api import tasks as tasks_module
from app.models import Task
from app.schemas import TaskCreate, TaskUpdate


class MockTaskQueryResult:
    def __init__(self, task=None):
        self._task = task

    def unique(self):
        return self

    def first(self):
        return self._task

    def all(self):
        return [self._task] if self._task else []


class MockScalars:
    def __init__(self, task=None):
        self._task = task

    def unique(self):
        return self

    def first(self):
        return self._task

    def all(self):
        return [self._task] if self._task else []


class DummySessionForTasks:
    """Заглушка AsyncSession для тестирования логики эндпоинтов /tasks."""

    def __init__(self, task_to_return=None):
        self.committed = False
        self.deleted = False
        self._task = task_to_return
        self._storage = {}

    def add(self, obj):
        # При добавлении задачи, сохраняем её, чтобы потом "найти"
        if isinstance(obj, Task):
            obj.id = 1 # Симулируем ID
            self._task = obj
            self._storage[1] = obj

    async def commit(self):
        self.committed = True

    async def execute(self, stmt):
        # Возвращаем заранее подготовленную задачу
        return MagicMock(scalars=lambda: MockScalars(self._task))

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


@pytest.mark.asyncio
async def test_create_task_fails_to_refresh(mock_request):
    """
    Проверяем редкий, но возможный случай, когда задача создана,
    но не может быть найдена сразу после создания.
    """
    # Сессия, которая ничего не возвращает при execute
    db = DummySessionForTasks(task_to_return=None)
    payload = TaskCreate(title="Test Task")

    # Имитируем, что db.add() сработал
    db.add(Task(**payload.model_dump()))

    with pytest.raises(HTTPException) as exc:
        await tasks_module.create_task(payload=payload, request=mock_request, db=db)

    assert exc.value.status_code == 404
    assert "Task not found after creation" in exc.value.detail


@pytest.mark.asyncio
async def test_update_task_not_found(mock_request):
    """Проверяем ошибку 404 при обновлении несуществующей задачи."""
    db = DummySessionForTasks(task_to_return=None) # execute вернет None
    payload = TaskUpdate(title="New Title")

    with pytest.raises(HTTPException) as exc:
        await tasks_module.update_task(task_id=999, payload=payload, request=mock_request, db=db)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Task not found"


@pytest.mark.asyncio
async def test_delete_task_success():
    """Проверяем успешное удаление задачи."""
    task_to_delete = Task(id=1, title="Initial title")
    db = DummySessionForTasks()
    db._storage = {1: task_to_delete} # Помещаем задачу в хранилище

    await tasks_module.delete_task(task_id=1, db=db)

    assert 1 not in db._storage
    assert db.deleted is True
    assert db.committed is True