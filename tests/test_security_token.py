# tests/test_security_token.py
from datetime import timedelta

from jose import jwt

from app.security import create_access_token, SECRET_KEY, ALGORITHM


def test_create_access_token_contains_expected_claims():
    token = create_access_token(
        subject=123,
        token_version=2,
        expires_delta=timedelta(minutes=5),
    )

    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    assert payload["sub"] == "123"
    assert payload["tv"] == 2
    # просто проверим, что поля вообще есть
    assert "iat" in payload
    assert "exp" in payload
