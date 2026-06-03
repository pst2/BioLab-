from __future__ import annotations

from fastapi.testclient import TestClient

from app.clients.ncbi_client import NCBIClient
from app.main import app


def test_root() -> None:
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True


def test_health(monkeypatch) -> None:
    async def fake_ping(self):
        return True

    monkeypatch.setattr(NCBIClient, "ping", fake_ping)
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "healthy"


def test_system_status_requires_api_key(monkeypatch) -> None:
    async def fake_ping(self):
        return True

    monkeypatch.setattr(NCBIClient, "ping", fake_ping)
    with TestClient(app) as client:
        response = client.get("/api/v1/system/status")
    assert response.status_code == 401


def test_system_status_accepts_api_key(monkeypatch) -> None:
    async def fake_ping(self):
        return True

    monkeypatch.setattr(NCBIClient, "ping", fake_ping)
    with TestClient(app) as client:
        response = client.get("/api/v1/system/status", headers={"X-API-Key": "dev-key-1"})
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "healthy"
