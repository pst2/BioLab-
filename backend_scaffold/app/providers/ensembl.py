from __future__ import annotations

import httpx

from app.providers.base import GeneProvider, GeneResult
from app.providers.visualization import enrich_with_sequence_fields, wrap_fasta

ENSEMBL_REST_URL = "https://rest.ensembl.org"

SPECIES_ALIASES = {
    "human": "homo_sapiens",
    "homo sapiens": "homo_sapiens",
    "mouse": "mus_musculus",
    "mus musculus": "mus_musculus",
    "rat": "rattus_norvegicus",
    "rattus norvegicus": "rattus_norvegicus",
    "zebrafish": "danio_rerio",
    "danio rerio": "danio_rerio",
    "fruit fly": "drosophila_melanogaster",
    "drosophila melanogaster": "drosophila_melanogaster",
    "dog": "canis_lupus_familiaris",
    "cat": "felis_catus",
    "cow": "bos_taurus",
    "pig": "sus_scrofa",
    "chicken": "gallus_gallus",
}


class EnsemblProvider(GeneProvider):
    """Fallback provider for human and animal genes."""

    name = "ensembl"

    async def search(
        self,
        *,
        query: str,
        organism: str | None = None,
        data_type: str = "gene",
        search_by: str = "name",
        limit: int = 10,
    ) -> list[GeneResult]:
        if data_type != "gene":
            return []

        query = query.strip()
        if not query:
            return []

        species = self._normalize_species(organism)
        if search_by == "id" and query.startswith("ENS"):
            return await self._lookup_id(query, species)
        return await self._lookup_symbol(query, species)

    async def _lookup_symbol(self, symbol: str, species: str) -> list[GeneResult]:
        url = f"{ENSEMBL_REST_URL}/lookup/symbol/{species}/{symbol}"
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        timeout = httpx.Timeout(6.0, connect=2.0)
        async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
            response = await client.get(url, params={"expand": 1})
        if response.status_code == 404:
            return []
        response.raise_for_status()
        data = response.json()
        return [self._normalize_result(data, species, fallback_symbol=symbol)]

    async def _lookup_id(self, ensembl_id: str, species: str) -> list[GeneResult]:
        detail = await self.get_detail(ensembl_id, organism=species)
        return [detail] if detail else []

    async def get_detail(self, ensembl_id: str, organism: str | None = None) -> GeneResult | None:
        """Return an enriched Ensembl gene record with sequence, FASTA and visualization data."""
        ensembl_id = str(ensembl_id or "").strip()
        if not ensembl_id:
            return None

        species = self._normalize_species(organism)
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        timeout = httpx.Timeout(10.0, connect=3.0)
        async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
            lookup = await client.get(f"{ENSEMBL_REST_URL}/lookup/id/{ensembl_id}", params={"expand": 1})
            if lookup.status_code == 404:
                return None
            lookup.raise_for_status()
            data = lookup.json()

            sequence = ""
            seq_response = await client.get(
                f"{ENSEMBL_REST_URL}/sequence/id/{ensembl_id}",
                params={"type": "genomic"},
                headers={"Accept": "text/plain"},
            )
            if seq_response.status_code == 200:
                sequence = seq_response.text.strip()

        record = self._normalize_result(data, species, fallback_symbol=ensembl_id)
        record.update(self._extract_location_and_transcripts(data))
        if sequence:
            record["sequence"] = sequence
            record["sequence_type"] = "genomic"
            record["fasta"] = wrap_fasta(
                f"{ensembl_id} {record.get('symbol') or ''} {record.get('organism') or species} genomic",
                sequence,
            )
        return enrich_with_sequence_fields(record, sequence_type="genomic")

    def _normalize_species(self, organism: str | None) -> str:
        if not organism:
            return "homo_sapiens"
        value = organism.lower().strip().replace("-", " ")
        if value in SPECIES_ALIASES:
            return SPECIES_ALIASES[value]
        return value.replace(" ", "_")

    def _extract_location_and_transcripts(self, data: dict) -> dict:
        transcripts = []
        for transcript in data.get("Transcript") or data.get("transcripts") or []:
            exons = []
            for exon in transcript.get("Exon") or transcript.get("exons") or []:
                exons.append({
                    "id": exon.get("id"),
                    "start": exon.get("start"),
                    "end": exon.get("end"),
                    "strand": exon.get("strand"),
                })
            translations = transcript.get("Translation") or transcript.get("translation") or {}
            transcripts.append({
                "id": transcript.get("id"),
                "biotype": transcript.get("biotype"),
                "start": transcript.get("start"),
                "end": transcript.get("end"),
                "strand": transcript.get("strand"),
                "protein_id": translations.get("id") if isinstance(translations, dict) else None,
                "exons": exons,
            })

        return {
            "chromosome": data.get("seq_region_name") or data.get("chromosome") or "Unknown",
            "start": data.get("start"),
            "end": data.get("end"),
            "strand": data.get("strand"),
            "assembly": data.get("assembly_name") or data.get("assembly") or "Unknown",
            "transcripts": transcripts,
        }

    def _normalize_result(self, data: dict, species: str, fallback_symbol: str) -> GeneResult:
        gene_id = str(data.get("id") or fallback_symbol)
        symbol = data.get("display_name") or fallback_symbol
        description = data.get("description") or ""
        return {
            "id": gene_id,
            "gene_id": gene_id,
            "external_id": gene_id,
            "data_type": "gene",
            "database": "ensembl",
            "symbol": symbol,
            "name": symbol,
            "description": description,
            "organism": species,
            "source": self.name,
            "source_url": f"https://www.ensembl.org/{species}/Gene/Summary?g={gene_id}",
            "provider_url": f"https://www.ensembl.org/{species}/Gene/Summary?g={gene_id}",
            "chromosome": data.get("seq_region_name") or data.get("chromosome") or "Unknown",
            "start": data.get("start"),
            "end": data.get("end"),
            "strand": data.get("strand"),
            "assembly": data.get("assembly_name") or data.get("assembly") or "Unknown",
            "raw": data,
        }
