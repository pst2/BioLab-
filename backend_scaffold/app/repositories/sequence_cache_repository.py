from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.repositories.cache_repository import CacheRepository


class SequenceCacheRepository:
    def __init__(self, db: Session, ttl_seconds: int = 86400) -> None:
        self.cache_repo = CacheRepository(db)
        self.ttl_seconds = ttl_seconds

    def get_valid(self, key: str) -> dict[str, Any] | None:
        return self.cache_repo.get_valid(key)

    def get_any(self, key: str) -> dict[str, Any] | None:
        return self.cache_repo.get_any(key)

    def set(self, key: str, value: dict[str, Any]) -> None:
        self.cache_repo.set(key, value, ttl_seconds=self.ttl_seconds)
