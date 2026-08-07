import pytest
from app.core.exceptions import (
    AppException,
    ProviderError,
    ProviderTimeoutError,
    ProviderRateLimitError,
    ProviderNotFoundError,
)


def test_provider_error_hierarchy():
    err = ProviderTimeoutError()
    assert isinstance(err, ProviderError)
    assert isinstance(err, AppException)
    assert err.status_code == 504
    assert err.error_code == "PROVIDER_TIMEOUT"


def test_provider_rate_limit_error():
    err = ProviderRateLimitError()
    assert err.status_code == 429
    assert err.error_code == "PROVIDER_RATE_LIMIT"


def test_provider_not_found_error():
    err = ProviderNotFoundError()
    assert err.status_code == 404
    assert err.error_code == "PROVIDER_NOT_FOUND"


def test_generic_exception_handler_no_traceback_leak():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.core.exceptions import register_exception_handlers

    test_app = FastAPI()
    register_exception_handlers(test_app)

    @test_app.get("/error-trigger")
    def trigger_crash():
        raise RuntimeError("Sensitive internal database connection string: db://admin:secret123@localhost")

    client = TestClient(test_app, raise_server_exceptions=False)
    res = client.get("/error-trigger")
    assert res.status_code == 500
    data = res.json()
    assert data["success"] is False
    assert data["message"] == "Internal server error"
    assert data["error_code"] == "INTERNAL_SERVER_ERROR"
    assert "secret123" not in res.text
    assert "Traceback" not in res.text

