# app/services/audit.py
from __future__ import annotations

from typing import Optional

from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, LoginEvent, Pyrotechnician


def _get_ip_and_ua(request: Optional[Request]) -> tuple[Optional[str], Optional[str]]:
    if not request:
        return None, None

    # Пытаемся получить реальный IP, если приложение за прокси (Nginx, etc.)
    ip = (
        request.headers.get("X-Real-IP")
        or request.headers.get("X-Forwarded-For")
    )
    # Если в X-Forwarded-For несколько IP, берем первый
    if ip and "," in ip:
        ip = ip.split(",")[0].strip()

    # Если заголовков нет, берем IP из прямого подключения
    if not ip and request.client:
        ip = request.client.host

    user_agent = request.headers.get("User-Agent")
    return ip, user_agent


async def log_login_event(
    db: AsyncSession,
    *,
    request: Optional[Request],
    pyro: Optional[Pyrotechnician],
    email: Optional[str],
    success: bool,
) -> None:
    """Записывает событие входа (успешного или нет) в БД."""
    ip, ua = _get_ip_and_ua(request)
    event = LoginEvent(
        user_id=pyro.id if pyro else None,
        email=email,
        success=success,
        ip=ip,
        user_agent=ua,
    )
    db.add(event)
    await db.commit()


async def log_audit(
    db: AsyncSession,
    *,
    request: Optional[Request],
    user: Optional[Pyrotechnician],
    action: str,
    object_type: Optional[str] = None,
    object_id: Optional[str] = None,
    description: Optional[str] = None,
) -> None:
    """Записывает действие пользователя в журнал аудита."""
    ip, _ = _get_ip_and_ua(request)
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        object_type=object_type,
        object_id=str(object_id) if object_id is not None else None,
        description=description,
        ip=ip,
    )
    db.add(entry)
    await db.commit()