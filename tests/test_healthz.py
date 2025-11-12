from starlette.testclient import TestClient
from app.main import app

def test_healthz():
    with TestClient(app) as c:
        r = c.get("/api/healthz")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"
