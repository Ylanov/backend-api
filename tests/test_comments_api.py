# tests/test_comments_api.py
import asyncio
from types import SimpleNamespace
from typing import Any, List

import pytest
from fastapi import HTTPException
from starlette.background import BackgroundTasks

from app.api import comments as comments_module
from app.models import TaskComment


class DummyPyro:
    """Простейший объект текущего пользователя с нужным полем id."""

    def __init__(self, pyro_id: int) -> None:
        self.id = pyro_id


class DummySessionTaskNotFound:
    """Session, в которой задача всегда не найдена."""

    async def get(self, model: Any, pk: Any) -> None:  # noqa: ARG002
        return None


class DummySessionForCreateComment:
    """
    Упрощённая "база данных" для успешного создания комментария.

    - get(Task, id) возвращает фейковую задачу
    - add() запоминает добавленные объекты
    - commit()/refresh()/execute() минимально имитируют поведение SQLAlchemy
    """

    def __init__(self) -> None:
        self.added: List[Any] = []
        self.committed: bool = False
        self._comment_obj: TaskComment | None = None

    async def get(self, model: Any, pk: Any) -> Any:  # noqa: ARG002
        # Нас интересует только наличие задачи для проверки 404
        # Для остальных моделей (если вдруг) просто возвращаем None
        if getattr(model, "__name__", "") == "Task":
            return SimpleNamespace(id=pk, title="Test task")
        return None

    def add(self, obj: Any) -> None:
        self.added.append(obj)
        if isinstance(obj, TaskComment):
            self._comment_obj = obj

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj: Any) -> None:  # noqa: ARG002
        # В реальной БД тут бы проставился id. Нам достаточно, чтобы он был не None.
        if isinstance(obj, TaskComment) and getattr(obj, "id", None) is None:
            obj.id = 1

    async def execute(self, stmt: Any) -> Any:  # noqa: ARG002
        """
        Имитация db.execute(select(TaskComment)...) → result.scalars().unique().one()
        Возвращаем тот же объект комментария, который был добавлен.
        """
        comment = self._comment_obj or TaskComment(
            id=1,
            text="from-db",
            task_id=1,
            author_id=1,
        )
        return _DummyExecuteResult(comment)


class _DummyExecuteResult:
    """Объект, у которого есть цепочка .scalars().unique().one()."""

    def __init__(self, obj: Any) -> None:
        self._obj = obj

    def scalars(self) -> "_DummyExecuteScalars":
        return _DummyExecuteScalars(self._obj)


class _DummyExecuteScalars:
    def __init__(self, obj: Any) -> None:
        self._obj = obj

    def unique(self) -> "_DummyExecuteScalars":
        return self

    def one(self) -> Any:
        return self._obj


def _make_fake_request() -> SimpleNamespace:
    """
    В create_task_comment используется только request.base_url,
    поэтому достаточно простого объекта с этим атрибутом.
    """
    return SimpleNamespace(base_url="http://testserver/")


# -------------------- ТЕСТЫ --------------------


def test_create_task_comment_raises_404_when_task_not_found() -> None:
    """
    Если задача не найдена, эндпоинт должен вернуть 404.
    """
    db = DummySessionTaskNotFound()
    background_tasks = BackgroundTasks()
    current_pyro = DummyPyro(pyro_id=1)
    request = _make_fake_request()

    async def _call() -> None:
        await comments_module.create_task_comment(
            task_id=123,
            background_tasks=background_tasks,
            request=request,
            db=db,
            text="Some text",
            files=None,
            current_pyro=current_pyro,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert "Task not found" in str(exc.value.detail)


def test_create_task_comment_requires_text_or_files() -> None:
    """
    Если не передан ни текст, ни файлы, должен быть 400 с понятным сообщением.
    """
    db = DummySessionForCreateComment()
    background_tasks = BackgroundTasks()
    current_pyro = DummyPyro(pyro_id=1)
    request = _make_fake_request()

    async def _call() -> None:
        await comments_module.create_task_comment(
            task_id=1,
            background_tasks=background_tasks,
            request=request,
            db=db,
            text=None,
            files=None,
            current_pyro=current_pyro,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    assert "Comment must have text or attachments" in str(exc.value.detail)


def test_create_task_comment_with_text_only_persists_and_schedules_notifications() -> None:
    """
    Позитивный сценарий:
    - задача существует
    - передаём только текст
    - комментарий сохраняется
    - выполняется commit
    - планируется фоновая задача отправки уведомлений
    """
    db = DummySessionForCreateComment()
    background_tasks = BackgroundTasks()
    current_pyro = DummyPyro(pyro_id=42)
    request = _make_fake_request()

    async def _call() -> TaskComment:
        return await comments_module.create_task_comment(
            task_id=1,
            background_tasks=background_tasks,
            request=request,
            db=db,
            text="Hello from test",
            files=None,
            current_pyro=current_pyro,
        )

    comment = asyncio.run(_call())

    # Проверяем, что был commit
    assert db.committed is True

    # Убедимся, что объект комментария реально добавлялся в "БД"
    assert any(isinstance(obj, TaskComment) for obj in db.added)

    # Проверим, что вернулся объект с тем же текстом
    assert isinstance(comment, TaskComment)
    assert comment.text == "Hello from test"

    # В BackgroundTasks должна появиться хотя бы одна задача (уведомления)
    # У starlette.background.BackgroundTasks есть .tasks со списком задач.
    assert len(background_tasks.tasks) >= 1
