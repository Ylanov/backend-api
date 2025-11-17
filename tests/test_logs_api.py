# tests/test_logs_api.py
import asyncio
from datetime import date, timedelta
from typing import Any, List

from app.api import logs as logs_module
from app.models import LoginEvent, AuditLog


# ======================== ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ =========================


class DummyAdmin:
    def __init__(self, pyro_id: int = 1, is_admin: bool = True) -> None:
        self.id = pyro_id
        self.is_admin = is_admin


class DummyResult:
    """
    Эмуляция результата db.execute(), у которого вызывают scalars().all().
    """

    def __init__(self, items: List[Any]) -> None:
        self._items = items

    class _Scalars:
        def __init__(self, items: List[Any]) -> None:
            self._items = items

        def all(self) -> List[Any]:
            return list(self._items)

    def scalars(self) -> "DummyResult._Scalars":
        return DummyResult._Scalars(self._items)


class DummySessionForLoginEvents:
    """
    Фейковая AsyncSession для list_login_events.
    Реальную SQL-логику не повторяем, просто возвращаем заранее подготовленный список.
    """

    def __init__(self, events: List[LoginEvent]) -> None:
        self.events = events
        self.received_statements = []

    async def execute(self, stmt: Any) -> DummyResult:  # noqa: ARG002
        # Сохраняем stmt только для отладки, если понадобится
        self.received_statements.append(stmt)
        return DummyResult(self.events)


class DummySessionForAuditLogs:
    """
    Фейковая AsyncSession для list_audit_logs.
    """

    def __init__(self, logs: List[AuditLog]) -> None:
        self.logs = logs
        self.received_statements = []

    async def execute(self, stmt: Any) -> DummyResult:  # noqa: ARG002
        self.received_statements.append(stmt)
        return DummyResult(self.logs)


# ========================= ТЕСТЫ list_login_events ========================


def test_list_login_events_returns_all_without_filters() -> None:
    # Подготавливаем "события логина"
    e1 = LoginEvent(
        id=1,
        user_id=10,
        email="user1@example.com",
        success=True,
        ip="1.1.1.1",
        user_agent="UA1",
    )
    e2 = LoginEvent(
        id=2,
        user_id=20,
        email="user2@example.com",
        success=False,
        ip="2.2.2.2",
        user_agent="UA2",
    )
    db = DummySessionForLoginEvents([e1, e2])
    admin = DummyAdmin()

    async def _call() -> list[LoginEvent]:
        return await logs_module.list_login_events(
            db=db,
            _=admin,  # админ для Depends(get_current_admin)
            user_id=None,
            success=None,
            limit=100,
            offset=0,
        )

    result = asyncio.run(_call())

    assert result == [e1, e2]
    # Убедимся, что SQL хоть раз дергался
    assert len(db.received_statements) == 1


def test_list_login_events_with_user_and_success_filters() -> None:
    """
    Проверяем ветки, где user_id и success заданы.
    Мы не тестируем сам SQL, только то, что код успешно отрабатывает.
    """
    e1 = LoginEvent(
        id=1,
        user_id=10,
        email="user1@example.com",
        success=True,
        ip="1.1.1.1",
        user_agent="UA1",
    )
    db = DummySessionForLoginEvents([e1])
    admin = DummyAdmin()

    async def _call() -> list[LoginEvent]:
        return await logs_module.list_login_events(
            db=db,
            _=admin,
            user_id=10,
            success=True,
            limit=50,
            offset=5,
        )

    result = asyncio.run(_call())

    assert result == [e1]
    assert len(db.received_statements) == 1


# ========================= ТЕСТЫ list_audit_logs ==========================


def test_list_audit_logs_without_filters() -> None:
    a1 = AuditLog(
        id=1,
        user_id=10,
        action="task.create",
        object_type="task",
        object_id="1",
        description="Created task 1",
        ip="3.3.3.3",
    )
    a2 = AuditLog(
        id=2,
        user_id=20,
        action="task.update",
        object_type="task",
        object_id="2",
        description="Updated task 2",
        ip="4.4.4.4",
    )
    db = DummySessionForAuditLogs([a1, a2])
    admin = DummyAdmin()

    async def _call() -> list[AuditLog]:
        return await logs_module.list_audit_logs(
            db=db,
            _=admin,
            user_id=None,
            action=None,
            object_type=None,
            date_from=None,
            date_to=None,
            limit=100,
            offset=0,
        )

    result = asyncio.run(_call())

    assert result == [a1, a2]
    assert len(db.received_statements) == 1


def test_list_audit_logs_with_all_filters_and_date_range() -> None:
    """
    Нагрузочный тест, чтобы пройти все if'ы:
    - user_id
    - action
    - object_type
    - date_from
    - date_to
    """
    today = date.today()
    yesterday = today - timedelta(days=1)

    a1 = AuditLog(
        id=1,
        user_id=999,
        action="auth.login",
        object_type="pyrotechnician",
        object_id="123",
        description="User login",
        ip="5.5.5.5",
    )

    db = DummySessionForAuditLogs([a1])
    admin = DummyAdmin()

    async def _call() -> list[AuditLog]:
        return await logs_module.list_audit_logs(
            db=db,
            _=admin,
            user_id=999,
            action="auth.login",
            object_type="pyrotechnician",
            date_from=yesterday,
            date_to=today,
            limit=10,
            offset=0,
        )

    result = asyncio.run(_call())

    # Возвращается наш один лог
    assert result == [a1]
    # SQL дергается один раз
    assert len(db.received_statements) == 1
