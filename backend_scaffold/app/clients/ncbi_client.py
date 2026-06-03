from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------- #
# Shared async client                                                       #
#                                                                           #
# httpx.AsyncClient is created once per NCBIClient instance (which is      #
# instantiated per-request via FastAPI's dependency injection).             #
#                                                                           #
# Using a context-manager per call (the old pattern) tears down and         #
# rebuilds the TCP connection on every NCBI request — wasteful when a       #
# single search does esearch + esummary back-to-back.                       #
#                                                                           #
# The client is entered/exited via async with so it is always cleaned up,   #
# even if an exception occurs mid-request.                                  #
# ----------------------------------------------------------------------- #


class NCBIClient:
    BASE_URL = settings.NCBI_BASE_URL.rstrip("/")

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Return (and lazily create) the shared async client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=settings.NCBI_TIMEOUT,
                headers={"User-Agent": f"{settings.APP_NAME}/{settings.APP_VERSION}"},
            )
        return self._client

    async def close(self) -> None:
        """Explicitly close the underlying client (call from lifespan if needed)."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------- #
    # Public API                                                            #
    # ------------------------------------------------------------------- #

    async def ping(self) -> bool:
        await self._get_json("einfo.fcgi", {"retmode": "json"})
        return True

    async def search_genes(self, keyword: str) -> list[dict[str, Any]]:
        search_params: dict[str, Any] = {
            "db": "gene",
            "term": keyword,
            "retmode": "json",
            "retmax": settings.NCBI_RETMAX,
        }
        search_data = await self._get_json("esearch.fcgi", search_params)
        id_list: list[str] = search_data.get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return []

        summary_params: dict[str, Any] = {
            "db": "gene",
            "id": ",".join(id_list),
            "retmode": "json",
        }
        summary_data = await self._get_json("esummary.fcgi", summary_params)
        result_map = summary_data.get("result", {})

        results: list[dict[str, Any]] = []
        for gene_id in id_list:
            item = result_map.get(gene_id, {})
            if not item:
                continue
            results.append(
                {
                    "gene_id": str(item.get("uid", gene_id)),
                    "symbol": item.get("name") or "",
                    "name": item.get("description") or "",
                    "description": self._shorten_text(
                        item.get("summary") or item.get("description") or "", 500
                    ),
                    "organism": self._extract_gene_organism(item),
                }
            )
        return results

    async def get_gene_by_id(self, gene_id: str) -> dict[str, Any] | None:
        """Fetch a single NCBI Gene record by Gene ID (used by the detail page)."""
        gene_id = str(gene_id).strip()
        if not gene_id:
            return None

        summary_params: dict[str, Any] = {
            "db": "gene",
            "id": gene_id,
            "retmode": "json",
        }
        summary_data = await self._get_json("esummary.fcgi", summary_params)
        item = summary_data.get("result", {}).get(gene_id, {})
        if not item:
            return None

        organism = self._extract_gene_organism(item)
        other_aliases = item.get("otheraliases") or ""
        aliases = [a.strip() for a in str(other_aliases).split(",") if a.strip()]

        return {
            "gene_id": str(item.get("uid", gene_id)),
            "symbol": item.get("name") or f"Gene {gene_id}",
            "name": item.get("description") or "",
            "description": item.get("description") or item.get("summary") or "",
            "summary": item.get("summary") or item.get("description") or "",
            "organism": organism,
            "chromosome": item.get("chromosome") or item.get("maplocation") or "Unknown",
            "aliases": aliases[:30],
            "ncbi_url": f"https://www.ncbi.nlm.nih.gov/gene/{gene_id}",
            "raw": item,
        }

    async def search_bio_records(
        self,
        *,
        data_type: str,
        query: str,
        search_by: str = "name",
        organism: str | None = None,
    ) -> list[dict[str, Any]]:
        """Search Gene, Nucleotide or Protein records through NCBI E-utilities.

        data_type accepts the UI values: gene, nucleotide, protein.
        search_by accepts: name or id.
        """
        ncbi_db = self._normalize_bio_database(data_type)
        normalized_type = self._normalize_bio_type(data_type)
        query = str(query).strip()
        if not query:
            return []

        if search_by == "id":
            id_list = await self._resolve_bio_ids_by_accession_or_uid(
                database=ncbi_db,
                data_type=normalized_type,
                query=query,
                organism=organism,
            )
        else:
            term = query
            if organism:
                term = f"{query} AND {organism}[Organism]"
            id_list = await self._esearch_ids(
                database=ncbi_db,
                term=term,
                retmax=settings.NCBI_RETMAX,
            )

        if not id_list:
            return []

        summary_params: dict[str, Any] = {
            "db": ncbi_db,
            "id": ",".join(str(item) for item in id_list),
            "retmode": "json",
        }
        summary_data = await self._get_json("esummary.fcgi", summary_params)
        result_map = summary_data.get("result", {})

        results: list[dict[str, Any]] = []
        for record_id in id_list:
            item = result_map.get(str(record_id), {})
            if not item:
                continue
            results.append(self._normalize_bio_summary(normalized_type, ncbi_db, str(record_id), item))
        return results

    async def _esearch_ids(
        self,
        *,
        database: str,
        term: str,
        retmax: int | None = None,
    ) -> list[str]:
        """Return internal NCBI UIDs from esearch.

        NCBI ESummary works most reliably with internal numeric UIDs.
        For nucleotide/protein accessions such as NM_007294 or NP_009225,
        we first resolve the accession to UID with ESearch, then call ESummary.
        """
        search_params: dict[str, Any] = {
            "db": database,
            "term": term,
            "retmode": "json",
            "retmax": retmax or settings.NCBI_RETMAX,
        }
        search_data = await self._get_json("esearch.fcgi", search_params)
        ids = search_data.get("esearchresult", {}).get("idlist", [])
        return [str(item) for item in ids if str(item).strip()]

    async def _resolve_bio_ids_by_accession_or_uid(
        self,
        *,
        database: str,
        data_type: str,
        query: str,
        organism: str | None = None,
    ) -> list[str]:
        """Resolve user-entered ID/accession to NCBI internal UID(s).

        Gene IDs are usually numeric UIDs and can be sent directly to ESummary.
        Nucleotide/protein IDs typed by users are often accessions
        (for example NM_007294 or NP_009225), not UIDs. Sending those directly
        to ESummary may return an HTTP error, which previously surfaced as
        NCBI_UNAVAILABLE. This resolver prevents that by using ESearch first.
        """
        value = str(query).strip()
        if not value:
            return []

        if data_type == "gene" and value.isdigit():
            return [value]

        if data_type in {"nucleotide", "protein"}:
            terms = [
                f"{value}[Accession]",
                f"{value}[Accession Version]",
                value,
            ]
            for term in terms:
                decorated_term = term
                if organism:
                    decorated_term = f"{term} AND {organism}[Organism]"
                ids = await self._esearch_ids(database=database, term=decorated_term, retmax=1)
                if ids:
                    return ids
            return []

        # Non-numeric Gene values in ID mode are probably symbols/accessions.
        # Resolve them through ESearch instead of sending them directly to ESummary.
        term = value
        if organism:
            term = f"{value} AND {organism}[Organism]"
        return await self._esearch_ids(database=database, term=term, retmax=1)

    def _normalize_bio_database(self, data_type: str) -> str:
        mapping = {
            "gene": "gene",
            "nucleotide": "nuccore",
            "nuccore": "nuccore",
            "protein": "protein",
        }
        return mapping.get(str(data_type).lower(), "gene")

    def _normalize_bio_type(self, data_type: str) -> str:
        value = str(data_type).lower()
        if value in {"nucleotide", "nuccore"}:
            return "nucleotide"
        if value == "protein":
            return "protein"
        return "gene"

    def _normalize_bio_summary(
        self,
        data_type: str,
        ncbi_db: str,
        record_id: str,
        item: dict[str, Any],
    ) -> dict[str, Any]:
        if data_type == "gene":
            gene_id = str(item.get("uid", record_id))
            return {
                "id": gene_id,
                "gene_id": gene_id,
                "external_id": gene_id,
                "data_type": "gene",
                "database": "gene",
                "symbol": item.get("name") or "",
                "name": item.get("description") or item.get("name") or "",
                "description": self._shorten_text(item.get("summary") or item.get("description") or "", 500),
                "organism": self._extract_gene_organism(item),
                "source": "ncbi",
                "ncbi_url": f"https://www.ncbi.nlm.nih.gov/gene/{gene_id}",
                "raw": item,
            }

        external_id = str(item.get("uid", record_id))
        title = item.get("title") or item.get("caption") or item.get("extra") or external_id
        caption = item.get("caption") or external_id
        organism = item.get("organism") or item.get("taxname") or "Unknown"
        if isinstance(organism, dict):
            organism = organism.get("scientificname") or organism.get("commonname") or "Unknown"

        return {
            "id": external_id,
            "gene_id": external_id,
            "external_id": external_id,
            "data_type": data_type,
            "database": ncbi_db,
            "symbol": caption,
            "name": title,
            "description": self._shorten_text(item.get("title") or item.get("extra") or "", 500),
            "organism": organism,
            "source": "ncbi",
            "ncbi_url": f"https://www.ncbi.nlm.nih.gov/{ncbi_db}/{external_id}",
            "raw": item,
        }

    async def search_pubmed(self, keyword: str) -> list[dict[str, Any]]:
        search_params: dict[str, Any] = {
            "db": "pubmed",
            "term": keyword,
            "retmode": "json",
            "retmax": settings.NCBI_RETMAX,
            "sort": "relevance",
        }
        search_data = await self._get_json("esearch.fcgi", search_params)
        id_list: list[str] = search_data.get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return []

        summary_params: dict[str, Any] = {
            "db": "pubmed",
            "id": ",".join(id_list),
            "retmode": "json",
        }
        summary_data = await self._get_json("esummary.fcgi", summary_params)
        result_map = summary_data.get("result", {})

        results: list[dict[str, Any]] = []
        for pmid in id_list:
            item = result_map.get(pmid, {})
            if not item:
                continue
            results.append(
                {
                    "pmid": str(item.get("uid", pmid)),
                    "title": item.get("title") or "",
                    "source": item.get("source") or "",
                    "pubdate": item.get("pubdate") or "",
                    "authors": self._extract_pubmed_authors(item),
                    "doi": self._extract_pubmed_doi(item),
                }
            )
        return results

    async def fetch_sequence_fasta(self, accession: str, db: str = "nuccore") -> str:
        params: dict[str, Any] = {
            "db": db,
            "id": accession,
            "rettype": "fasta",
            "retmode": "text",
        }
        return await self._get_text("efetch.fcgi", params)

    async def fetch_sequence_genbank(self, accession: str, db: str = "nuccore") -> str:
        params: dict[str, Any] = {
            "db": db,
            "id": accession,
            "rettype": "gb",
            "retmode": "text",
        }
        return await self._get_text("efetch.fcgi", params)

    # ------------------------------------------------------------------- #
    # Private helpers                                                        #
    # ------------------------------------------------------------------- #

    def _extract_gene_organism(self, item: dict[str, Any]) -> str:
        organism = item.get("organism")
        if isinstance(organism, dict):
            return organism.get("scientificname") or organism.get("commonname") or "Unknown"
        return "Unknown"

    def _extract_pubmed_authors(self, item: dict[str, Any]) -> list[str]:
        authors = item.get("authors", [])
        if not isinstance(authors, list):
            return []
        result: list[str] = []
        for author in authors:
            if isinstance(author, dict):
                name = author.get("name")
                if name:
                    result.append(name)
            elif isinstance(author, str):
                result.append(author)
        return result[:10]

    def _extract_pubmed_doi(self, item: dict[str, Any]) -> str | None:
        article_ids = item.get("articleids", [])
        if not isinstance(article_ids, list):
            return None
        for article_id in article_ids:
            if isinstance(article_id, dict) and article_id.get("idtype") == "doi":
                return article_id.get("value")
        return None

    def _shorten_text(self, text: str, max_length: int = 300) -> str:
        if not text:
            return ""
        text = text.strip()
        return text if len(text) <= max_length else text[:max_length].rstrip() + "..."

    async def _get_json(self, endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
        response = await self._request(endpoint, params)
        return response.json()

    async def _get_text(self, endpoint: str, params: dict[str, Any]) -> str:
        response = await self._request(endpoint, params)
        return response.text

    async def _request(self, endpoint: str, params: dict[str, Any]) -> httpx.Response:
        url = f"{self.BASE_URL}/{endpoint}"
        request_params = dict(params)
        if settings.NCBI_API_KEY:
            request_params["api_key"] = settings.NCBI_API_KEY

        client = await self._get_client()
        last_error: Exception | None = None

        for attempt in range(settings.NCBI_RETRY_COUNT + 1):
            try:
                logger.info(
                    "NCBI request attempt=%d endpoint=%s", attempt + 1, endpoint
                )
                response = await client.get(url, params=request_params)
                response.raise_for_status()
                return response
            except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.NetworkError) as exc:
                last_error = exc
                logger.warning(
                    "NCBI request failed attempt=%d endpoint=%s error=%s",
                    attempt + 1,
                    endpoint,
                    exc,
                )
                if attempt >= settings.NCBI_RETRY_COUNT:
                    raise
                await asyncio.sleep(0.5 * (2**attempt))

        raise RuntimeError(f"NCBI request failed after retries: {last_error!r}")
