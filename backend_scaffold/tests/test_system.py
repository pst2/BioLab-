from __future__ import annotations

import pytest

from app.services.system_service import SystemService


@pytest.mark.asyncio
async def test_health_is_healthy_when_db_and_ncbi_ok(db_session, monkeypatch):
    service = SystemService(db_session)

    async def fake_ping():
        return True

    monkeypatch.setattr(service.ncbi_client, "ping", fake_ping)
    result = await service.health_check()
    assert result.data["status"] == "healthy"


@pytest.mark.asyncio
async def test_health_is_degraded_when_ncbi_down(db_session, monkeypatch):
    service = SystemService(db_session)

    async def fake_ping():
        raise RuntimeError("down")

    monkeypatch.setattr(service.ncbi_client, "ping", fake_ping)
    result = await service.health_check()
    assert result.data["status"] == "degraded"
    assert result.data["ncbi"] is False


@pytest.mark.asyncio
async def test_system_status_reports_services(db_session, monkeypatch):
    service = SystemService(db_session)

    async def fake_ping():
        return True

    monkeypatch.setattr(service.ncbi_client, "ping", fake_ping)
    result = await service.system_status()
    assert result.data["services"]["database"] == "up"
