from __future__ import annotations

import pytest

from app.core.exceptions import AuthenticationException, ServiceUnavailableException
from app.core.security import verify_api_key


def test_verify_api_key_accepts_valid_key(monkeypatch):
    monkeypatch.setattr("app.core.security.settings.API_KEYS", "alpha,beta")
    monkeypatch.setattr("app.core.security.settings.DEBUG", False)
    verify_api_key("alpha")


def test_verify_api_key_rejects_missing_key(monkeypatch):
    monkeypatch.setattr("app.core.security.settings.API_KEYS", "alpha")
    monkeypatch.setattr("app.core.security.settings.DEBUG", False)
    with pytest.raises(AuthenticationException):
        verify_api_key(None)


def test_verify_api_key_rejects_invalid_key(monkeypatch):
    monkeypatch.setattr("app.core.security.settings.API_KEYS", "alpha")
    monkeypatch.setattr("app.core.security.settings.DEBUG", False)
    with pytest.raises(AuthenticationException):
        verify_api_key("wrong")


def test_verify_api_key_allows_dev_mode_without_keys(monkeypatch):
    monkeypatch.setattr("app.core.security.settings.API_KEYS", "")
    monkeypatch.setattr("app.core.security.settings.DEBUG", True)
    verify_api_key(None)


def test_verify_api_key_rejects_production_without_keys(monkeypatch):
    monkeypatch.setattr("app.core.security.settings.API_KEYS", "")
    monkeypatch.setattr("app.core.security.settings.DEBUG", False)
    with pytest.raises(ServiceUnavailableException):
        verify_api_key(None)


PUBLIC_PATHS = {"/", "/api/v1/health", "/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"}


def test_all_routes_require_api_key_except_whitelist(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setattr("app.core.config.settings.API_KEYS", "test-key")
    monkeypatch.setattr("app.core.config.settings.DEBUG", False)
    client = TestClient(app)
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path or path in PUBLIC_PATHS or "{" in path:
            continue
        for method in getattr(route, "methods", []) or []:
            if method in ("HEAD", "OPTIONS"):
                continue
            r = client.request(method, path)
            assert r.status_code in (401, 422), f"{method} {path} leaked (status {r.status_code})"

