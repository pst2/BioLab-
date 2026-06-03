from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

GeneResult = dict[str, Any]


class GeneProvider(ABC):
    """Common interface for external gene/protein search providers."""

    name: str

    @abstractmethod
    async def search(
        self,
        *,
        query: str,
        organism: str | None = None,
        data_type: str = "gene",
        search_by: str = "name",
        limit: int = 10,
    ) -> list[GeneResult]:
        """Return normalized search results."""
