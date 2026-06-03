from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.data.mock_genes import MOCK_GENES
from app.providers.orchestrator import GeneProviderOrchestrator
from app.providers.ensembl import EnsemblProvider
from app.providers.uniprot import UniProtProvider
from app.providers.visualization import enrich_with_sequence_fields
from app.repositories.gene_repository import GeneRepository
from app.services.base_search_service import BaseSearchService


class GeneService(BaseSearchService):
    search_type = "gene_search"
    cache_version = "v3"
    success_message = "Gene search completed successfully from NCBI and saved to local workspace"
    cache_message = "Gene search loaded from local cache"
    local_message = "Gene search loaded from local gene database"
    mock_message = (
        "NCBI unavailable and no local data found — "
        "showing bundled reference data. "
        "Run a search with mode=external_refresh when NCBI is back online."
    )
    unavailable_message = "Gene search is temporarily unavailable"
    cache_ttl_seconds = settings.CACHE_TTL_GENE_SECONDS

    # mock_data is the LAST resort fallback (after cache → local DB → NCBI).
    # It is intentionally small and labelled so users know it is reference data,
    # not a real search result.
    mock_data = MOCK_GENES

    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.gene_repo = GeneRepository(db)
        self.provider_orchestrator = GeneProviderOrchestrator()
        self.ensembl_provider = EnsemblProvider()
        self.uniprot_provider = UniProtProvider()

    async def search_genes(
        self,
        keyword: str,
        mode: str = "local_first",
        data_type: str = "gene",
        search_by: str = "name",
        organism: str | None = None,
    ):
        data_type = self._normalize_data_type(data_type)
        search_by = self._normalize_search_by(search_by)
        organism = (organism or "").strip() or None

        # Keep the old local-first/cache flow, but make the external step resilient:
        # NCBI is tried first; Ensembl/UniProt/BV-BRC are used only if NCBI is down
        # or returns no result. The frontend response envelope remains unchanged.
        if data_type == "gene" and search_by == "name" and not organism:
            async def external_gene_search(_: str):
                return await self.provider_orchestrator.search_with_fallbacks(
                    primary_search=lambda: self.ncbi_client.search_genes(keyword),
                    query=keyword,
                    organism=None,
                    data_type="gene",
                    search_by="name",
                    limit=settings.NCBI_RETMAX,
                )

            return await self.search(
                keyword,
                external_gene_search,
                mode=mode,
                local_search_fn=self.gene_repo.search,
                local_save_fn=self.gene_repo.upsert_many,
            )

        # Extended Bio Search: Gene/Nucleotide/Protein + organism + ID/name.
        # Local DB currently stores only genes, so nucleotide/protein searches use NCBI
        # through the same resilient cache/fallback response envelope.
        decorated_keyword = self._build_decorated_keyword(
            keyword=keyword,
            data_type=data_type,
            search_by=search_by,
            organism=organism,
        )

        async def external_search(_: str):
            return await self.provider_orchestrator.search_with_fallbacks(
                primary_search=lambda: self.ncbi_client.search_bio_records(
                    data_type=data_type,
                    query=keyword,
                    search_by=search_by,
                    organism=organism,
                ),
                query=keyword,
                organism=organism,
                data_type=data_type,
                search_by=search_by,
                limit=settings.NCBI_RETMAX,
            )

        def local_search(_: str):
            if data_type != "gene":
                return []
            if search_by == "id":
                item = self.gene_repo.get_by_gene_id(keyword)
                return [item] if item else []
            results = self.gene_repo.search(keyword)
            if organism:
                lowered = organism.lower()
                results = [
                    item for item in results
                    if lowered in str(item.get("organism", "")).lower()
                ]
            return results

        def local_save(items, source="ncbi"):
            if data_type == "gene":
                self.gene_repo.upsert_many(items, source)

        return await self.search(
            decorated_keyword,
            external_search,
            mode=mode,
            local_search_fn=local_search,
            local_save_fn=local_save,
        )

    def _normalize_data_type(self, data_type: str) -> str:
        value = str(data_type or "gene").lower().strip()
        if value in {"nucleotide", "nuccore"}:
            return "nucleotide"
        if value == "protein":
            return "protein"
        return "gene"

    def _normalize_search_by(self, search_by: str) -> str:
        value = str(search_by or "name").lower().strip()
        return "id" if value == "id" else "name"

    def _build_decorated_keyword(
        self,
        *,
        keyword: str,
        data_type: str,
        search_by: str,
        organism: str | None,
    ) -> str:
        parts = [f"type={data_type}", f"by={search_by}", f"q={keyword.strip()}"]
        if organism:
            parts.append(f"organism={organism}")
        return " | ".join(parts)

    async def get_gene_detail(self, gene_id: str):
        gene_id = str(gene_id).strip()

        # 1. Try local DB first, then enrich the cached provider payload when possible.
        local = self.gene_repo.get_by_gene_id(gene_id)
        if local:
            enriched = await self._enrich_detail_record(local)
            if enriched != local:
                self.gene_repo.upsert(enriched, source=enriched.get("source") or local.get("source") or "local_db")
                self.db.commit()
            return self._response(
                message="Gene detail loaded from local workspace database",
                data=enriched,
                source=enriched.get("source") or "local_db",
                cached=False,
                stale=False,
                keyword=gene_id,
                mode="local_first",
                external_used=bool(enriched.get("sequence") or enriched.get("fasta") or enriched.get("visualization")),
            )

        # 2. If the detail ID is clearly from a fallback provider, query that provider directly.
        provider_detail = await self._fetch_provider_detail(gene_id)
        if provider_detail:
            self.gene_repo.upsert(provider_detail, source=provider_detail.get("source") or "provider")
            self.db.commit()
            return self._response(
                message="Gene detail imported from fallback provider and saved to local workspace",
                data=provider_detail,
                source=provider_detail.get("source") or "provider",
                cached=False,
                stale=False,
                keyword=gene_id,
                mode="local_first",
                external_used=True,
            )

        # 3. Import from NCBI exactly once, persist, then serve from local DB.
        try:
            external_gene = await self.ncbi_client.get_gene_by_id(gene_id)
            if external_gene:
                external_gene = enrich_with_sequence_fields(external_gene)
                self.gene_repo.upsert(external_gene, source="ncbi")
                self.db.commit()
                saved = self.gene_repo.get_by_gene_id(gene_id) or external_gene
                return self._response(
                    message="Gene detail imported from NCBI and saved to local workspace",
                    data=saved,
                    source="ncbi",
                    cached=False,
                    stale=False,
                    keyword=gene_id,
                    mode="local_first",
                    external_used=True,
                )
        except Exception:
            # Keep the detail page usable even when NCBI is unavailable.
            pass

        # 4. Nothing found anywhere — return a minimal placeholder so the UI
        #    does not crash; include a hint so the developer knows what to do.
        placeholder = enrich_with_sequence_fields({
            "id": gene_id,
            "gene_id": gene_id,
            "symbol": f"Gene {gene_id}",
            "description": "No local gene record found.",
            "organism": "Unknown",
            "summary": (
                "Try searching this gene with mode=external_refresh "
                "to import it, then reopen the detail page."
            ),
            "chromosome": "Unknown",
            "aliases": [],
            "ncbi_url": f"https://www.ncbi.nlm.nih.gov/gene/{gene_id}",
        })
        return {
            "success": True,
            "message": (
                "Gene detail is not available in local workspace "
                "and could not be imported from external providers."
            ),
            "data": placeholder,
            "meta": {
                "source": "none",
                "cached": False,
                "stale": True,
                "keyword": gene_id,
                "mode": "local_first",
                "external_used": False,
                "dependency_policy": "local-first; NCBI is primary, Ensembl/UniProt/BV-BRC can be used as fallback providers",
                "estimated_dependency_ratio": {
                    "internal_percent": 65,
                    "ncbi_percent": 35,
                    "fallback_provider_percent": 0,
                },
            },
        }

    async def _enrich_detail_record(self, record: dict):
        source = str(record.get("source") or record.get("database") or "").lower()
        record_id = str(record.get("gene_id") or record.get("external_id") or record.get("id") or "").strip()
        if not record_id:
            return enrich_with_sequence_fields(record)

        # Avoid repeated network calls if the saved payload already has rich detail.
        if record.get("fasta") or record.get("sequence") or record.get("visualization"):
            return enrich_with_sequence_fields(record)

        try:
            if source == "ensembl" or record_id.startswith("ENS"):
                return await self.ensembl_provider.get_detail(record_id, organism=record.get("organism")) or enrich_with_sequence_fields(record)
            if source == "uniprot" or record.get("database") == "uniprotkb":
                return await self.uniprot_provider.get_detail(record_id) or enrich_with_sequence_fields(record)
        except Exception:
            return enrich_with_sequence_fields(record)
        return enrich_with_sequence_fields(record)

    async def _fetch_provider_detail(self, gene_id: str):
        try:
            if gene_id.startswith("ENS"):
                return await self.ensembl_provider.get_detail(gene_id)
            # UniProt accessions are usually short alphanumeric IDs such as P38398.
            if 5 <= len(gene_id) <= 12 and any(char.isalpha() for char in gene_id):
                return await self.uniprot_provider.get_detail(gene_id)
        except Exception:
            return None
        return None
