from __future__ import annotations

import httpx

from app.providers.base import GeneProvider, GeneResult

BVBRC_FEATURE_URL = "https://www.bv-brc.org/api/genome_feature/"


class BvBrcProvider(GeneProvider):
    """Fallback provider for bacterial and viral genome features."""

    name = "bvbrc"

    async def search(
        self,
        *,
        query: str,
        organism: str | None = None,
        data_type: str = "gene",
        search_by: str = "name",
        limit: int = 10,
    ) -> list[GeneResult]:
        if data_type not in {"gene", "protein"}:
            return []

        query = query.strip()
        if not query:
            return []

        params = {
            "http_accept": "application/json",
            "limit": limit,
            "q": query if not organism else f"{query} {organism}",
        }
        timeout = httpx.Timeout(8.0, connect=2.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(BVBRC_FEATURE_URL, params=params)
        if response.status_code in {400, 404}:
            return []
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, list):
            items = payload
        else:
            items = payload.get("response", {}).get("docs", [])
        return [self._normalize_result(item) for item in items[:limit]]

    def _normalize_result(self, item: dict) -> GeneResult:
        feature_id = item.get("feature_id") or item.get("patric_id") or item.get("refseq_locus_tag") or item.get("na_feature_id")
        gene_symbol = item.get("gene") or item.get("refseq_locus_tag") or item.get("product") or feature_id
        product = item.get("product") or gene_symbol or "Unknown genome feature"
        feature_id = str(feature_id or gene_symbol or product)
        return {
            "id": feature_id,
            "gene_id": feature_id,
            "external_id": feature_id,
            "data_type": "gene",
            "database": "bv-brc",
            "symbol": gene_symbol,
            "name": product,
            "description": product,
            "organism": item.get("genome_name") or item.get("organism_name") or item.get("taxon_name") or "Unknown",
            "source": self.name,
            "source_url": f"https://www.bv-brc.org/view/Feature/{feature_id}",
            "provider_url": f"https://www.bv-brc.org/view/Feature/{feature_id}",
            "raw": item,
        }
