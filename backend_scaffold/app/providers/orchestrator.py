from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from app.core.config import settings
from app.providers.base import GeneProvider, GeneResult
from app.providers.bvbrc import BvBrcProvider
from app.providers.ensembl import EnsemblProvider
from app.providers.uniprot import UniProtProvider

logger = logging.getLogger(__name__)

ExternalSearch = Callable[[], Awaitable[list[GeneResult]]]

BACTERIA_VIRUS_KEYWORDS = {
    "bacteria", "bacterium", "virus", "viral", "sars-cov-2", "covid",
    "influenza", "escherichia", "salmonella", "staphylococcus",
    "mycobacterium", "bacillus", "pseudomonas", "streptococcus",
}

HUMAN_ANIMAL_KEYWORDS = {
    "human", "homo sapiens", "mouse", "mus musculus", "rat", "zebrafish",
    "dog", "cat", "cow", "pig", "chicken", "animal", "drosophila",
}

PLANT_KEYWORDS = {
    "arabidopsis", "rice", "oryza", "maize", "zea", "soybean", "glycine",
    "wheat", "triticum", "plant", "plants",
}


class GeneProviderOrchestrator:
    """Runs NCBI first, then trusted providers when NCBI is unavailable or empty."""

    def __init__(self) -> None:
        self.ensembl = EnsemblProvider()
        self.uniprot = UniProtProvider()
        self.bvbrc = BvBrcProvider()

    async def search_with_fallbacks(
        self,
        *,
        primary_search: ExternalSearch,
        query: str,
        organism: str | None = None,
        data_type: str = "gene",
        search_by: str = "name",
        limit: int | None = None,
    ) -> list[GeneResult]:
        limit = limit or settings.NCBI_RETMAX
        primary_error: Exception | None = None

        try:
            primary_results = await primary_search()
            if primary_results:
                return [self._ensure_source(item, "ncbi") for item in primary_results[:limit]]
        except Exception as exc:
            primary_error = exc
            logger.warning("NCBI primary gene search failed: %s", exc)

        fallback_results: list[GeneResult] = []
        for provider in self._select_fallbacks(organism=organism, data_type=data_type):
            try:
                provider_results = await provider.search(
                    query=query,
                    organism=organism,
                    data_type=data_type,
                    search_by=search_by,
                    limit=limit,
                )
                fallback_results.extend(provider_results)
            except Exception as exc:
                logger.warning("%s fallback search failed: %s", provider.name, exc)

        fallback_results = self._deduplicate(fallback_results)
        if fallback_results:
            return fallback_results[:limit]

        if primary_error is not None:
            raise primary_error
        return []

    def _select_fallbacks(self, *, organism: str | None, data_type: str) -> list[GeneProvider]:
        text = (organism or "").lower()

        if data_type == "protein":
            return [self.uniprot, self.bvbrc]

        if any(keyword in text for keyword in BACTERIA_VIRUS_KEYWORDS):
            return [self.bvbrc, self.uniprot]

        if any(keyword in text for keyword in PLANT_KEYWORDS):
            # Phytozome can be added later behind this same provider interface.
            # UniProt is safe here because it covers plant proteins/functions.
            return [self.uniprot]

        if any(keyword in text for keyword in HUMAN_ANIMAL_KEYWORDS):
            return [self.ensembl, self.uniprot]

        # Unknown organism: try broad providers from most gene-like to most broad.
        return [self.ensembl, self.uniprot, self.bvbrc]

    def _ensure_source(self, item: GeneResult, source: str) -> GeneResult:
        normalized = dict(item)
        normalized.setdefault("source", source)
        normalized.setdefault("database", source)
        normalized.setdefault("data_type", "gene")
        if "id" not in normalized:
            normalized["id"] = normalized.get("gene_id") or normalized.get("external_id") or normalized.get("symbol")
        return normalized

    def _deduplicate(self, results: list[GeneResult]) -> list[GeneResult]:
        seen: set[tuple[str, str]] = set()
        unique: list[GeneResult] = []
        for item in results:
            source = str(item.get("source") or item.get("database") or "unknown")
            record_id = str(item.get("id") or item.get("gene_id") or item.get("external_id") or item.get("symbol") or "")
            key = (source, record_id)
            if not record_id or key in seen:
                continue
            seen.add(key)
            unique.append(item)
        return unique
