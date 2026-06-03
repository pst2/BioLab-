from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings


class AppException(Exception):
    def __init__(self, message: str, error_code: str = "APP_ERROR", status_code: int = 400):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(message)


class AuthenticationException(AppException):
    def __init__(self, message: str = "Authentication failed", error_code: str = "AUTHENTICATION_FAILED"):
        super().__init__(message=message, error_code=error_code, status_code=401)


class ServiceUnavailableException(AppException):
    def __init__(self, message: str = "Service unavailable", error_code: str = "SERVICE_UNAVAILABLE"):
        super().__init__(message=message, error_code=error_code, status_code=503)


class ExternalServiceError(AppException):
    def __init__(self, message: str = "External service unavailable"):
        super().__init__(message=message, error_code="NCBI_UNAVAILABLE", status_code=503)


class ValidationError(AppException):
    def __init__(self, message: str = "Invalid input"):
        super().__init__(message=message, error_code="INVALID_INPUT", status_code=422)


async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code,
        },
    )


async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": str(exc.detail),
            "error_code": "HTTP_ERROR",
        },
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    content = {
        "success": False,
        "message": "Request validation failed",
        "error_code": "REQUEST_VALIDATION_ERROR",
    }
    if settings.DEBUG:
        content["detail"] = exc.errors()
    return JSONResponse(status_code=422, content=content)


async def generic_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    content = {
        "success": False,
        "message": "Internal server error",
        "error_code": "INTERNAL_SERVER_ERROR",
    }
    return JSONResponse(status_code=500, content=content)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
