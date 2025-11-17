# tests/test_dashboard_api.py
import asyncio
from typing import List, Optional, Any

from app.api.dashboard import get_dashboard_stats


# ============================
# ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ
# ============================

class DummyScalarResult:
    """
    Заглушка для объекта результата, у которого вызывают .scalar_one_or_none().
    """
    def __init__(self, value: Optional[int]):
        self._value = value

    def scalar_one_or_none(self) -> Optional[int]:
        return self._value


class DummySessionForDashboard:
    """
    Заглушка AsyncSession, которая имитирует выполнение двух последовательных
    запросов func.count() в эндпоинте get_dashboard_stats.
    """
    def __init__(self, scalar_results: List[Optional[int]]):
        # Очередь результатов для последовательных вызовов db.execute()
        self._scalar_results = scalar_results

    async def execute(self, stmt: Any) -> DummyScalarResult:
        """
        При каждом вызове возвращает следующий результат из очереди.
        Мы не анализируем сам SQL-запрос (stmt), а полагаемся на то,
        что эндпоинт вызывает execute() в предсказуемом порядке.
        """
        if not self._scalar_results:
            raise AssertionError("db.execute() был вызван больше раз, чем ожидалось.")

        # Извлекаем следующий результат из очереди
        value_to_return = self._scalar_results.pop(0)
        return DummyScalarResult(value_to_return)


# ============================
# ТЕСТЫ
# ============================

def test_get_dashboard_stats_happy_path():
    """
    Проверяет стандартный сценарий, когда есть и задачи в работе, и свободные команды.
    """
    # Первый вызов (задачи) вернет 5, второй (команды) - 3.
    db = DummySessionForDashboard(scalar_results=[5, 3])

    async def _call():
        return await get_dashboard_stats(db=db)

    stats = asyncio.run(_call())

    assert stats.tasks_in_progress == 5
    assert stats.free_teams == 3


def test_get_dashboard_stats_zero_values():
    """
    Проверяет сценарий, когда нет задач в работе, и все команды свободны.
    """
    # Задач в работе - 0, свободных команд - 10.
    db = DummySessionForDashboard(scalar_results=[0, 10])

    async def _call():
        return await get_dashboard_stats(db=db)

    stats = asyncio.run(_call())

    assert stats.tasks_in_progress == 0
    assert stats.free_teams == 10


def test_get_dashboard_stats_handles_none_from_db():
    """
    Проверяет, что если запрос к БД возвращает None (например, в пустой таблице),
    код корректно обрабатывает это и возвращает 0.
    """
    # Оба запроса func.count() вернули None вместо числа.
    db = DummySessionForDashboard(scalar_results=[None, None])

    async def _call():
        return await get_dashboard_stats(db=db)

    stats = asyncio.run(_call())

    # Благодаря `... or 0` в коде эндпоинта, None должен превратиться в 0.
    assert stats.tasks_in_progress == 0
    assert stats.free_teams == 0