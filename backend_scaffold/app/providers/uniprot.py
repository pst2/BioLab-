from __future__ import annotations

import httpx

from app.providers.base import GeneProvider, GeneResult
from app.providers.visualization import wrap_fasta

UNIPROT_SEARCH_URL = "https://rest.uniprot.org/uniprotkb/search"
UNIPROT_ENTRY_URL = "https://rest.uniprot.org/uniprotkb"


class UniProtProvider(GeneProvider):
    """Fallback/supplemental provider for protein and gene-function records."""

    name = "uniprot"

    async def search(
        self,
        *,
        query: str,
        organism: str | None = None,
        data_type: str = "gene",
        search_by: str = "name",
        limit: int = 10,
    ) -> list[GeneResult]:
        query = query.strip()
        if not query:
            return []

        if search_by == "id":
            search_query = f"accession:{query} OR id:{query}"
        else:
            search_query = f"gene_exact:{query} OR gene:{query} OR protein_name:{query}"

        if organism:
            search_query = f"({search_query}) AND organism_name:{organism}"

        params = {
            "query": search_query,
            "format": "json",
            "size": limit,
            "fields": "accession,id,gene_names,protein_name,organism_name,cc_function,sequence,ft_domain,ft_region",
        }
        timeout = httpx.Timeout(6.0, connect=2.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(UNIPROT_SEARCH_URL, params=params)
        if response.status_code in {400, 404}:
            return []
        response.raise_for_status()
        payload = response.json()
        return [self._normalize_result(item, query) for item in payload.get("results", [])[:limit]]

    async def get_detail(self, accession: str) -> GeneResult | None:
        """Return a UniProt record enriched with protein sequence, FASTA and features."""
        accession = str(accession or "").strip()
        if not accession:
            return None
        timeout = httpx.Timeout(10.0, connect=3.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{UNIPROT_ENTRY_URL}/{accession}.json")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return self._normalize_result(response.json(), accession)

    def _extract_function(self, item: dict) -> str | None:
        for comment in item.get("comments") or []:
            if comment.get("commentType") == "FUNCTION":
                texts = comment.get("texts") or []
                if texts and isinstance(texts[0], dict):
                    return texts[0].get("value")
        return None

    def _extract_features(self, item: dict) -> list[dict]:
        features = []
        for feature in item.get("features") or []:
            location = feature.get("location") or {}
            start = location.get("start") or {}
            end = location.get("end") or {}
            features.append({
                "type": feature.get("type"),
                "name": feature.get("description") or feature.get("type"),
                "start": start.get("value") if isinstance(start, dict) else start,
                "end": end.get("value") if isinstance(end, dict) else end,
            })
        return features

    def _normalize_result(self, item: dict, query: str) -> GeneResult:
        accession = item.get("primaryAccession") or item.get("uniProtkbId") or query
        genes = item.get("genes") or []
        gene_symbol = None
        if genes and isinstance(genes[0], dict):
            gene_name = genes[0].get("geneName") or {}
            gene_symbol = gene_name.get("value")

        protein_description = item.get("proteinDescription") or {}
        recommended = protein_description.get("recommendedName") or {}
        full_name = recommended.get("fullName") or {}
        protein_name = full_name.get("value") or item.get("uniProtkbId") or gene_symbol or query

        organism_data = item.get("organism") or {}
        organism_name = organism_data.get("scientificName") or organism_data.get("commonName") or "Unknown"

        sequence_data = item.get("sequence") or {}
        protein_sequence = sequence_data.get("value") if isinstance(sequence_data, dict) else None
        protein_length = sequence_data.get("length") if isinstance(sequence_data, dict) else None
        function_text = self._extract_function(item)
        features = self._extract_features(item)
        protein = {
            "uniprot_id": str(accession),
            "name": protein_name,
            "length": protein_length,
            "function": function_text,
            "sequence": protein_sequence,
            "fasta": wrap_fasta(f"sp|{accession}|{item.get('uniProtkbId') or gene_symbol or query}", protein_sequence),
            "features": features,
        }

        return {
            "id": str(accession),
            "gene_id": str(accession),
            "external_id": str(accession),
            "data_type": "protein",
            "database": "uniprotkb",
            "symbol": gene_symbol or query,
            "name": protein_name,
            "description": function_text or protein_name,
            "summary": function_text or protein_name,
            "organism": organism_name,
            "source": self.name,
            "source_url": f"https://www.uniprot.org/uniprotkb/{accession}/entry",
            "provider_url": f"https://www.uniprot.org/uniprotkb/{accession}/entry",
            "sequence": protein_sequence,
            "sequence_type": "protein",
            "sequence_length": protein_length,
            "fasta": protein["fasta"],
            "protein": protein,
            "visualization": {
                "protein": protein,
                "sequence_composition": {},
                "location": {},
                "transcripts": [],
            },
            "raw": item,
        }
