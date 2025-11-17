# tests/test_audit_service.py
import asyncio
from typing import Optional

from fastapi import HTTPException  # noqa: F401  # на будущее, если что-то добавишь
import pytest

from app.services import audit as audit_module
from app.services.audit import log_login_event, log_audit
from app.models import LoginEvent, AuditLog


# ========================= ВСПОМОГАТЕЛЬНЫЕ ОБЪЕКТЫ ==========================


class DummyClient:
    def __init__(self, host: str):
        self.host = host


class DummyRequest:
    """
    Упрощённый аналог starlette.requests.Request,
    только с теми полями, которые реально использует _get_ip_and_ua.
    """

    def __init__(
        self,
        headers: Optional[dict[str, str]] = None,
        client_host: Optional[str] = None,
    ) -> None:
        self.headers = headers or {}
        self.client = DummyClient(client_host) if client_host is not None else None


class DummySession:
    """
    Простая фейковая "сессия" с методами add/commit для log_login_event и log_audit.
    """

    def __init__(self) -> None:
        self.added: list[object] = []
        self.commits: int = 0

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.commits += 1


class DummyPyro:
    def __init__(self, pyro_id: int = 1, email: str = "user@example.com") -> None:
        self.id = pyro_id
        self.email = email


# ========================= ТЕСТЫ _get_ip_and_ua =============================


def test_get_ip_and_ua_none_request_returns_none_tuple() -> None:
    ip, ua = audit_module._get_ip_and_ua(None)  # noqa: SLF001
    assert ip is None
    assert ua is None


def test_get_ip_and_ua_prefers_x_real_ip_over_x_forwarded_for() -> None:
    request = DummyRequest(
        headers={
            "X-Real-IP": "1.2.3.4",
            "X-Forwarded-For": "10.0.0.1, 10.0.0.2",
            "User-Agent": "TestUA/1.0",
        },
        client_host="9.9.9.9",
    )

    ip, ua = audit_module._get_ip_and_ua(request)  # noqa: SLF001

    assert ip == "1.2.3.4"
    assert ua == "TestUA/1.0"


def test_get_ip_and_ua_uses_first_from_x_forwarded_for_list() -> None:
    request = DummyRequest(
        headers={
            "X-Forwarded-For": "10.0.0.1, 10.0.0.2 , 10.0.0.3",
            "User-Agent": "BrowserXYZ",
        },
        client_host="8.8.8.8",
    )

    ip, ua = audit_module._get_ip_and_ua(request)  # noqa: SLF001

    assert ip == "10.0.0.1"
    assert ua == "BrowserXYZ"


def test_get_ip_and_ua_falls_back_to_client_host_when_no_headers() -> None:
    request = DummyRequest(
        headers={},
        client_host="5.6.7.8",
    )

    ip, ua = audit_module._get_ip_and_ua(request)  # noqa: SLF001

    assert ip == "5.6.7.8"
    assert ua is None


# ========================= ТЕСТЫ log_login_event ============================


def test_log_login_event_success_with_pyro_and_request() -> None:
    db = DummySession()
    pyro = DummyPyro(pyro_id=123, email="user@example.com")

    request = DummyRequest(
        headers={
            "X-Real-IP": "203.0.113.10",
            "User-Agent": "Mozilla/5.0 (Test)",
        },
        client_host="10.0.0.5",
    )

    async def _call() -> None:
        await log_login_event(
            db=db,
            request=request,
            pyro=pyro,
            email=pyro.email,
            success=True,
        )

    asyncio.run(_call())

    # Проверяем, что одно событие добавлено и коммит был
    assert db.commits == 1
    assert len(db.added) == 1
    event = db.added[0]
    assert isinstance(event, LoginEvent)
    assert event.user_id == pyro.id
    assert event.email == pyro.email
    assert event.success is True
    assert event.ip == "203.0.113.10"
    assert event.user_agent == "Mozilla/5.0 (Test)"


def test_log_login_event_failure_without_pyro_and_request() -> None:
    db = DummySession()

    async def _call() -> None:
        await log_login_event(
            db=db,
            request=None,
            pyro=None,
            email="unknown@example.com",
            success=False,
        )

    asyncio.run(_call())

    assert db.commits == 1
    assert len(db.added) == 1
    event = db.added[0]
    assert isinstance(event, LoginEvent)
    assert event.user_id is None
    assert event.email == "unknown@example.com"
    assert event.success is False
    assert event.ip is None
    assert event.user_agent is None


# ========================= ТЕСТЫ log_audit ==================================


def test_log_audit_with_user_and_object_info() -> None:
    db = DummySession()
    user = DummyPyro(pyro_id=777, email="admin@example.com")

    request = DummyRequest(
        headers={
            "X-Forwarded-For": "192.0.2.1, 192.0.2.2",
        },
        client_host="10.1.1.1",
    )

    async def _call() -> None:
        await log_audit(
            db=db,
            request=request,
            user=user,
            action="task.update",
            object_type="task",
            object_id=42,
            description="Updated task #42",
        )

    asyncio.run(_call())

    assert db.commits == 1
    assert len(db.added) == 1
    entry = db.added[0]
    assert isinstance(entry, AuditLog)
    assert entry.user_id == user.id
    assert entry.action == "task.update"
    assert entry.object_type == "task"
    # object_id приводится к строке в реализации
    assert entry.object_id == "42"
    assert entry.description == "Updated task #42"
    # должен взять первый IP из X-Forwarded-For
    assert entry.ip == "192.0.2.1"


def test_log_audit_without_user_and_object_id() -> None:
    db = DummySession()

    request = DummyRequest(
        headers={},
        client_host=None,
    )

    async def _call() -> None:
        await log_audit(
            db=db,
            request=request,
            user=None,
            action="system.event",
            object_type=None,
            object_id=None,
            description=None,
        )

    asyncio.run(_call())

    assert db.commits == 1
    assert len(db.added) == 1
    entry = db.added[0]
    assert isinstance(entry, AuditLog)
    assert entry.user_id is None
    assert entry.action == "system.event"
    assert entry.object_type is None
    assert entry.object_id is None
    assert entry.description is None
    # IP не смогли определить → None
    assert entry.ip is None
