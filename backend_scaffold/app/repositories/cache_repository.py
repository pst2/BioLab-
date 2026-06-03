from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import CacheEntry


class CacheRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, cache_key: str) -> Any | None:
        entry = (
            self.db.query(CacheEntry)
            .filter(CacheEntry.cache_key == cache_key)
            .first()
        )
        return entry.payload if entry else None

    def get_any(self, cache_key: str) -> Any | None:
        entry = (
            self.db.query(CacheEntry)
            .filter(CacheEntry.cache_key == cache_key)
            .first()
        )
        return entry.payload if entry else None

    def get_valid(self, cache_key: str) -> Any | None:
        entry = (
            self.db.query(CacheEntry)
            .filter(CacheEntry.cache_key == cache_key)
            .first()
        )

        if not entry:
            return None

        if entry.expires_at is not None:
            now = datetime.now(timezone.utc)
            expires_at = entry.expires_at

            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at < now:
                return None

        return entry.payload

    def set(self, cache_key: str, payload: Any, ttl_seconds: int | None = 3600):
        entry = (
            self.db.query(CacheEntry)
            .filter(CacheEntry.cache_key == cache_key)
            .first()
        )

        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
            if ttl_seconds is not None
            else None
        )

        if entry:
            entry.payload = payload
            entry.expires_at = expires_at
        else:
            entry = CacheEntry(
                cache_key=cache_key,
                payload=payload,
                expires_at=expires_at,
            )
            self.db.add(entry)

        self.db.commit()
        self.db.refresh(entry)
        return entry