from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.orm import Session

from app.clients.ncbi_client import NCBIClient
from app.core.exceptions import ServiceUnavailableException
from app.repositories.cache_repository import CacheRepository
from app.repositories.history_repository import HistoryRepository

logger = logging.getLogger(__name__)

SearchFunction = Callable[[str], Awaitable[list[dict[str, Any]]]]


class BaseSearchService:
    search_type: str = "search"
    cache_version: str = "v1"
    success_message: str = "Search completed successfully"
    cache_message: str = "Search loaded from local cache"
    local_message: str = "Search loaded from local workspace database"
    mock_message: str = "External service unavailable, showing bundled local reference data"
    unavailable_message: str = "Search service is temporarily unavailable"
    cache_ttl_seconds: int = 3600
    mock_data: dict[str, list[dict[str, Any]]] = {}

    def __init__(self, db: Session):
        self.db = db
        self.cache_repo = CacheRepository(db)
        self.history_repo = HistoryRepository(db)
        self.ncbi_client = NCBIClient()

    async def search(
        self,
        keyword: str,
        search_fn: SearchFunction,
        *,
        mode: str = "local_first",
        local_search_fn: Callable[[str], list[dict[str, Any]]] | None = None,
        local_save_fn: Callable[[list[dict[str, Any]], str], None] | None = None,
    ):
        keyword = keyword.strip()
        mode = self._normalize_mode(mode)
        cache_key = f"{self.search_type}:{self.cache_version}:{keyword.lower()}"

        if mode == "local_only":
            local_result = local_search_fn(keyword) if local_search_fn else []
            if local_result:
                return self._final_response(
                    message=self.local_message,
                    data=local_result,
                    source="local_db",
                    cached=False,
                    stale=False,
                    keyword=keyword,
                    mode=mode,
                    external_used=False,
                )
            mock_data = self._mock_result(keyword)
            if mock_data:
                return self._final_response(
                    message=self.mock_message,
                    data=mock_data,
                    source="local_mock",
                    cached=False,
                    stale=False,
                    keyword=keyword,
                    mode=mode,
                    external_used=False,
                )
            return self._final_response(
                message="No local data found. Switch to local_first or external_refresh to use NCBI.",
                data=[],
                source="local_db",
                cached=False,
                stale=False,
                keyword=keyword,
                mode=mode,
                external_used=False,
            )

        if mode != "external_refresh":
            valid_cache = self.cache_repo.get_valid(cache_key)
            if valid_cache:
                return self._final_response(
                    message=self.cache_message,
                    data=valid_cache,
                    source="cache",
                    cached=True,
                    stale=False,
                    keyword=keyword,
                    mode=mode,
                    external_used=False,
                )

            local_result = local_search_fn(keyword) if local_search_fn else []
            if local_result:
                return self._final_response(
                    message=self.local_message,
                    data=local_result,
                    source="local_db",
                    cached=False,
                    stale=False,
                    keyword=keyword,
                    mode=mode,
                    external_used=False,
                )

        try:
            result = await search_fn(keyword)
            if result:
                result_source = self._infer_external_source(result, default="ncbi")
                self.cache_repo.set(cache_key, result, ttl_seconds=self.cache_ttl_seconds)
                if local_save_fn:
                    local_save_fn(result, result_source)
                return self._final_response(
                    message=self._success_message_for_source(result_source),
                    data=result,
                    source=result_source,
                    cached=False,
                    stale=False,
                    keyword=keyword,
                    mode=mode,
                    external_used=True,
                )
        except Exception as exc:
            logger.exception("External %s failed for keyword=%s: %s", self.search_type, keyword, exc)

        stale_cache = self.cache_repo.get_any(cache_key)
        if stale_cache:
            return self._final_response(
                message="External providers unavailable, showing stale local cache data",
                data=stale_cache,
                source="cache",
                cached=True,
                stale=True,
                keyword=keyword,
                mode=mode,
                external_used=False,
            )

        local_result = local_search_fn(keyword) if local_search_fn else []
        if local_result:
            return self._final_response(
                message="External providers unavailable, showing local workspace database data",
                data=local_result,
                source="local_db",
                cached=False,
                stale=True,
                keyword=keyword,
                mode=mode,
                external_used=False,
            )

        mock_data = self._mock_result(keyword)
        if mock_data:
            if local_save_fn:
                local_save_fn(mock_data, "local_mock")
            return self._final_response(
                message=self.mock_message,
                data=mock_data,
                source="local_mock",
                cached=False,
                stale=True,
                keyword=keyword,
                mode=mode,
                external_used=False,
            )

        raise ServiceUnavailableException(
            message=self.unavailable_message,
            error_code="NCBI_UNAVAILABLE",
        )


    def _infer_external_source(self, data: Any, default: str = "ncbi") -> str:
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict):
                return str(first.get("source") or first.get("database") or default)
        if isinstance(data, dict):
            return str(data.get("source") or data.get("database") or default)
        return default

    def _success_message_for_source(self, source: str) -> str:
        if source == "ncbi":
            return self.success_message
        provider_name = source.upper() if source == "bvbrc" else source.title()
        return f"Gene search completed through {provider_name} fallback and saved to local workspace"

    def _mock_result(self, keyword: str) -> list[dict[str, Any]] | None:
        """Return bundled reference data for plain or decorated search keys.

        Extended Bio Search uses cache keys such as:
        ``type=nucleotide | by=id | q=NM_007294 | organism=Homo sapiens``.
        The old implementation only checked the whole string, so fallback data
        for NM_007294/NP_009225 was never found when NCBI failed.
        """
        lowered = keyword.lower().strip()
        exact = self.mock_data.get(lowered)
        if exact:
            return exact

        # Extract q=... from decorated keys produced by GeneService.
        for part in lowered.split("|"):
            part = part.strip()
            if part.startswith("q="):
                query_value = part[2:].strip()
                if query_value in self.mock_data:
                    return self.mock_data[query_value]

        return None

    def _normalize_mode(self, mode: str) -> str:
        allowed = {"local_first", "local_only", "external_refresh"}
        return mode if mode in allowed else "local_first"

    def _final_response(
        self,
        *,
        message: str,
        data: Any,
        source: str,
        cached: bool,
        stale: bool,
        keyword: str,
        mode: str,
        external_used: bool,
    ) -> dict[str, Any]:
        count = len(data) if isinstance(data, list) else 0
        try:
            self.history_repo.create(
                query_type=self.search_type,
                keyword=keyword,
                mode=mode,
                result_source=source,
                result_count=count,
            )
        except Exception:
            logger.exception("Failed to record search history")
        return self._response(
            message=message,
            data=data,
            source=source,
            cached=cached,
            stale=stale,
            keyword=keyword,
            mode=mode,
            external_used=external_used,
        )

    def _response(
        self,
        *,
        message: str,
        data: Any,
        source: str,
        cached: bool,
        stale: bool,
        keyword: str,
        mode: str = "local_first",
        external_used: bool = False,
    ) -> dict[str, Any]:
        count = len(data) if isinstance(data, list) else None
        external_sources = {"ncbi", "ensembl", "uniprot", "bvbrc", "phytozome"}
        external_share = 35 if source in external_sources else 0
        ncbi_share = 35 if source == "ncbi" else 0
        fallback_provider_share = 35 if source in external_sources and source != "ncbi" else 0
        internal_share = 100 - external_share
        return {
            "success": True,
            "message": message,
            "data": data,
            "meta": {
                "source": source,
                "cached": cached,
                "stale": stale,
                "keyword": keyword,
                "count": count,
                "mode": mode,
                "external_used": external_used,
                "dependency_policy": "local-first; NCBI is primary, Ensembl/UniProt/BV-BRC can be used as fallback providers",
                "estimated_dependency_ratio": {
                    "internal_percent": internal_share,
                    "ncbi_percent": ncbi_share,
                    "fallback_provider_percent": fallback_provider_share,
                },
            },
        }
