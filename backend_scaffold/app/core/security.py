from __future__ import annotations

import secrets

from fastapi import Depends, Header

from app.core.config import settings
from app.core.exceptions import AuthenticationException, ServiceUnavailableException


def verify_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    """Validate X-API-Key using timing-safe comparison.

    Development mode is intentionally permissive only when DEBUG=true and no
    API_KEYS are configured. Production should always configure API_KEYS.
    """
    if not settings.api_keys_list:
        if settings.DEBUG:
            return
        raise ServiceUnavailableException(
            message="API key authentication is not configured",
            error_code="API_AUTH_NOT_CONFIGURED",
        )

    if not x_api_key:
        raise AuthenticationException(message="Missing X-API-Key header")

    for valid_key in settings.api_keys_list:
        if secrets.compare_digest(x_api_key, valid_key):
            return

    raise AuthenticationException(message="Invalid API key")


RequireApiKey = Depends(verify_api_key)
