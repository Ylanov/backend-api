# tests/test_security_admin.py
import pytest
from fastapi import HTTPException

from app.security import get_current_admin
from app.models import Pyrotechnician


def test_get_current_admin_allows_admin():
    user = Pyrotechnician()
    user.is_admin = True

    result = get_current_admin(current=user)

    assert result is user


def test_get_current_admin_forbidden_for_non_admin():
    user = Pyrotechnician()
    user.is_admin = False

    with pytest.raises(HTTPException) as exc:
        get_current_admin(current=user)

    assert exc.value.status_code == 403
    assert "требуются права администратора" in exc.value.detail.lower()
