# tests/test_reports_api.py
import asyncio
from datetime import date
from types import SimpleNamespace
from typing import List, Any

import pytest

from app.api import reports as reports_module
from app.models import Task, Team, Zone, TaskComment, Pyrotechnician, TaskAttachment
from app.schemas import TaskStatus, TaskPriority

# ============================
# ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ
# ============================

class DummyResult:
    """Эмуляция результата db.execute() для поддержки .scalars().unique().all()."""

    def __init__(self, items: List[Any]):
        self._items = items

    def scalars(self):
        class _Scalars:
            def __init__(self, items):
                self._items = items
            def unique(self):
                # Просто возвращаем self, т.к. в моках дубликатов нет
                return self
            def all(self):
                return list(self._items)
        return _Scalars(self._items)


class DummySessionForReports:
    """
    Заглушка AsyncSession, которая возвращает предопределенный список задач
    при вызове execute(), игнорируя сам SQL-запрос.
    """

    def __init__(self, tasks: List[Task]):
        self._tasks_to_return = tasks

    async def execute(self, stmt: Any) -> DummyResult:
        # Мы не анализируем stmt, просто возвращаем подготовленные данные.
        # Это позволяет тестировать логику обработки, а не SQL.
        return DummyResult(self._tasks_to_return)


def _make_fake_request() -> SimpleNamespace:
    """Создает простой объект-заглушку для Request с атрибутом base_url."""
    return SimpleNamespace(base_url="http://testserver/")


def _create_dummy_task(task_id: int, title: str) -> Task:
    """Вспомогательная функция для создания тестовой задачи со связями."""
    task = Task(id=task_id, title=title)
    task.team = Team(id=1, name="Team Alpha")
    task.zone = Zone(id=1, name="Zone A")
    comment = TaskComment(id=101, text="Test comment")
    comment.author = Pyrotechnician(id=201, full_name="Author")
    comment.attachments = [TaskAttachment(id=301, unique_name="file.jpg")]
    task.comments = [comment]
    return task


@pytest.fixture
def mock_patching_service(monkeypatch):
    """
    Фикстура для подмены (мок) сервисной функции patch_attachments_urls.
    Это изолирует тест от логики этого сервиса.
    """
    # Список для отслеживания вызовов, если это понадобится
    calls = []

    def _dummy_patch(task: Task, base_url: str):
        # В моке мы ничего не делаем, просто фиксируем вызов
        calls.append({"task_id": task.id, "base_url": base_url})
        pass

    monkeypatch.setattr(reports_module, "patch_attachments_urls", _dummy_patch)
    return calls


# ============================
# ТЕСТЫ
# ============================

def test_get_tasks_report_no_filters(mock_patching_service):
    """
    Проверяет базовый сценарий без фильтров.
    Ожидаем, что все задачи из "БД" будут возвращены, и для каждой
    будет вызвана функция патчинга URL.
    """
    task1 = _create_dummy_task(1, "Task 1")
    task2 = _create_dummy_task(2, "Task 2")
    db = DummySessionForReports(tasks=[task1, task2])
    request = _make_fake_request()

    async def _call():
        return await reports_module.get_tasks_report(request=request, db=db)

    result_tasks = asyncio.run(_call())

    # Проверяем, что эндпоинт вернул наши задачи
    assert len(result_tasks) == 2
    assert result_tasks[0].title == "Task 1"
    assert result_tasks[1].title == "Task 2"

    # Проверяем, что сервис для патчинга URL был вызван для обеих задач
    assert len(mock_patching_service) == 2
    assert mock_patching_service[0]["task_id"] == 1
    assert mock_patching_service[1]["task_id"] == 2


def test_get_tasks_report_with_all_filters(mock_patching_service):
    """
    "Нагрузочный" тест, который передает все возможные фильтры.
    Цель - убедиться, что все if-блоки в коде отрабатывают без ошибок
    и запрос выполняется. Мы не проверяем саму фильтрацию.
    """
    task1 = _create_dummy_task(1, "Filtered Task")
    db = DummySessionForReports(tasks=[task1])
    request = _make_fake_request()

    async def _call():
        return await reports_module.get_tasks_report(
            request=request,
            db=db,
            date_from=date(2025, 1, 1),
            date_to=date(2025, 1, 31),
            team_id=1,
            zone_id=1,
            status=TaskStatus.COMPLETED,
            priority=TaskPriority.HIGH,
        )

    result_tasks = asyncio.run(_call())

    # Ожидаем, что наш единственный мок-объект будет возвращен
    assert len(result_tasks) == 1
    assert result_tasks[0] is task1
    # И сервис патчинга был вызван
    assert len(mock_patching_service) == 1


def test_get_tasks_report_empty_result(mock_patching_service):
    """
    Проверяет, что эндпоинт корректно возвращает пустой список,
    если запрос к БД ничего не нашел.
    """
    # "База данных" не вернет ни одной задачи
    db = DummySessionForReports(tasks=[])
    request = _make_fake_request()

    async def _call():
        return await reports_module.get_tasks_report(request=request, db=db)

    result_tasks = asyncio.run(_call())

    # Ожидаем пустой список
    assert result_tasks == []
    # Сервис патчинга не должен был вызываться ни разу
    assert len(mock_patching_service) == 0