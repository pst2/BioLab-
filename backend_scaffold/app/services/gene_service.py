from __future__ import annotations

import re
from typing import Any
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
            data_type = str(local.get("data_type") or "gene").lower()
            is_nucleotide_or_protein = data_type in ("nucleotide", "protein")
            missing_accession = is_nucleotide_or_protein and not local.get("genomic_accession")
            type_mismatch = gene_id.isdigit() and data_type != "gene"
            is_placeholder = (
                local.get("description") in ("No local gene record found.", "", None)
                and not local.get("sequence")
                and not local.get("fasta")
            )

            if not missing_accession and not is_placeholder and not type_mismatch:
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

        # 3. Import from NCBI Gene DB. If the ID is a numeric UID that belongs to
        #    a nucleotide or protein record (not a gene record), gene lookup returns
        #    None. In that case fall through to step 3b.
        external_gene: dict | None = None
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
            pass

        # 3b. The UID/accession may belong to a nuccore or protein record rather than
        #     the gene database. Try those databases as a fallback before giving up.
        looks_like_accession = (
            gene_id.isdigit()
            or (any(ch.isdigit() for ch in gene_id) and any(ch.isalpha() for ch in gene_id))
            or not any(ch.isalpha() for ch in gene_id)
        )
        if looks_like_accession:
            try:
                bio_record = await self.ncbi_client.get_bio_record_by_id(gene_id)
                if bio_record:
                    bio_record = enrich_with_sequence_fields(bio_record)
                    self.gene_repo.upsert(bio_record, source="ncbi")
                    self.db.commit()
                    saved = self.gene_repo.get_by_gene_id(gene_id) or bio_record
                    return self._response(
                        message="Record detail imported from NCBI nucleotide/protein database",
                        data=saved,
                        source="ncbi",
                        cached=False,
                        stale=False,
                        keyword=gene_id,
                        mode="local_first",
                        external_used=True,
                    )
            except Exception:
                pass

        # 3c. Fallback search resolution if lookup by exact ID failed
        try:
            search_res = await self.search_genes(keyword=gene_id, mode="local_first")
            if search_res and isinstance(search_res.get("data"), list) and len(search_res["data"]) > 0:
                first_match = search_res["data"][0]
                enriched = await self._enrich_detail_record(first_match)
                self.gene_repo.upsert(enriched, source=enriched.get("source") or "ncbi")
                self.db.commit()
                return self._response(
                    message="Gene detail resolved via fallback search",
                    data=enriched,
                    source=enriched.get("source") or "ncbi",
                    cached=False,
                    stale=False,
                    keyword=gene_id,
                    mode="local_first",
                    external_used=True,
                )
        except Exception:
            pass

        # 4. Nothing found anywhere — return a minimal placeholder so the UI does not crash.
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
        return self._response(
            message="Gene detail is not available in local workspace and could not be imported from external providers.",
            data=placeholder,
            source="none",
            cached=False,
            stale=True,
            keyword=gene_id,
            mode="local_first",
            external_used=False,
        )

    async def _enrich_detail_record(self, record: dict):
        source = str(record.get("source") or record.get("database") or "").lower()
        record_id = str(record.get("gene_id") or record.get("external_id") or record.get("id") or "").strip()
        if not record_id:
            return enrich_with_sequence_fields(record)

        has_real_data = bool(record.get("fasta") or record.get("sequence"))

        missing_igv_data = (
            source == "ncbi"
            and record.get("data_type", "gene") == "gene"
            and record_id.isdigit()
            and not record.get("genomic_accession")
        )

        if missing_igv_data:
            try:
                fresh = await self.ncbi_client.get_gene_by_id(record_id)
                if fresh and fresh.get("genomic_accession"):
                    record = {
                        **record,
                        "genomic_accession": fresh["genomic_accession"],
                        "start": fresh.get("start") or record.get("start"),
                        "end": fresh.get("end") or record.get("end"),
                        "chromosome": fresh.get("chromosome") or record.get("chromosome"),
                    }
            except Exception:
                pass

        _s = record.get("start")
        _e = record.get("end")
        if _s is not None and _e is not None:
            try:
                if int(_s) > int(_e):
                    record = {**record, "start": int(_e), "end": int(_s)}
            except (TypeError, ValueError):
                pass

        if has_real_data:
            return enrich_with_sequence_fields(record)

        try:
            if source == "ensembl" or record_id.startswith("ENS"):
                return await self.ensembl_provider.get_detail(record_id, organism=record.get("organism")) or enrich_with_sequence_fields(record)
            if source == "uniprot" or record.get("database") == "uniprotkb":
                return await self.uniprot_provider.get_detail(record_id) or enrich_with_sequence_fields(record)
            # For NCBI nucleotide/protein records without sequence, try to re-fetch from nuccore/protein
            if source == "ncbi" and record.get("data_type") in ("nucleotide", "protein") and record_id.isdigit():
                bio = await self.ncbi_client.get_bio_record_by_id(record_id)
                if bio and (bio.get("fasta") or bio.get("sequence")):
                    return enrich_with_sequence_fields(bio)
        except Exception:
            return enrich_with_sequence_fields(record)
        return enrich_with_sequence_fields(record)

    async def _fetch_provider_detail(self, gene_id: str):
        try:
            if gene_id.startswith("ENS"):
                return await self.ensembl_provider.get_detail(gene_id)
            _UNIPROT_RE = re.compile(
                r"^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$",
                re.IGNORECASE,
            )
            if _UNIPROT_RE.match(gene_id):
                return await self.uniprot_provider.get_detail(gene_id)
        except Exception:
            return None
        return None
