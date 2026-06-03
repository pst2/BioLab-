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
