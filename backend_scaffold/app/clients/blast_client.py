"""
blast_client.py – Multi-provider BLAST client for EBI NCBI BLAST and UniProt BLAST.

Providers:
  - ebi      : EBI NCBI BLAST REST API (protein + DNA)
  - uniprot  : UniProt BLAST REST API  (protein only)

Auto-fallback: if 'auto' is requested and EBI submission fails for a protein
sequence, the client will transparently retry with UniProt BLAST.
"""
from __future__ import annotations

import hashlib
import logging
import urllib.parse
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Provider constants ─────────────────────────────────────────────────────────

EBI_URL = "https://www.ebi.ac.uk/Tools/services/rest/ncbiblast"
UNIPROT_URL = "https://rest.uniprot.org"

# Unique amino-acid characters that cannot appear in a DNA/RNA sequence
_PROTEIN_UNIQUE: frozenset[str] = frozenset("EFILPQXZJOB")
_DNA_CHARS: frozenset[str] = frozenset("ATGCNRYWSMKHBVD")

# Default databases per provider × sequence type
DEFAULT_DATABASES: dict[str, dict[str, str]] = {
    "ebi": {
        "protein": "uniprotkb_swissprot",
        "dna": "em_std_hum",
    },
    "uniprot": {
        "protein": "UniProtKB",
        "dna": "",   # UniProt BLAST is protein-only
    },
}


class BlastClient:
    """Async client for EBI NCBI BLAST and UniProt BLAST."""

    def __init__(self) -> None:
        self._http: httpx.AsyncClient | None = None

    # ── Internal helpers ───────────────────────────────────────────────────── #

    async def _client(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={
                    "User-Agent": f"{settings.APP_NAME}/{settings.APP_VERSION} (contact:{settings.BLAST_CONTACT_EMAIL})"
                },
            )
        return self._http

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()
            self._http = None

    # ── Sequence helpers ───────────────────────────────────────────────────── #

    def strip_header(self, sequence: str) -> str:
        """Remove FASTA header line(s) and normalise whitespace."""
        seq = sequence.strip()
        if seq.startswith(">"):
            lines = seq.split("\n")
            seq = "".join(lines[1:])
        return seq.upper().replace(" ", "").replace("\r", "").replace("\n", "")

    def detect_type(self, sequence: str) -> str:
        """Return 'protein' or 'dna' by examining the first 200 residues."""
        seq = self.strip_header(sequence)
        sample = set(seq[:200])
        # Any uniquely-protein amino acid → protein
        if sample & _PROTEIN_UNIQUE:
            return "protein"
        # ≥ 85 % DNA chars → DNA
        dna_count = sum(1 for c in seq[:200] if c in _DNA_CHARS)
        return "dna" if seq and dna_count / min(len(seq), 200) >= 0.85 else "protein"

    def make_cache_key(
        self, sequence: str, seq_type: str, database: str, provider: str
    ) -> str:
        seq_hash = hashlib.md5(self.strip_header(sequence).encode()).hexdigest()
        return f"blast:{provider}:{seq_type}:{database}:{seq_hash}"

    # ── EBI BLAST ─────────────────────────────────────────────────────────── #

    async def ebi_submit(
        self, sequence: str, seq_type: str, database: str
    ) -> str:
        """Submit a job to EBI NCBI BLAST and return the job ID."""
        clean = self.strip_header(sequence)
        program = "blastp" if seq_type == "protein" else "blastn"
        stype = "protein" if seq_type == "protein" else "dna"

        # Map legacy or invalid aliases
        if database in ("emrel", "embl", "em_rel"):
            database = "em_std"

        params = {
            "email": settings.BLAST_CONTACT_EMAIL,
            "program": program,
            "stype": stype,
            "sequence": clean,
            "database": database,
            "alignments": "50",
            "scores": "50",
            "exp": "10",
        }
        data = urllib.parse.urlencode(params).encode("utf-8")
        client = await self._client()
        resp = await client.post(
            f"{EBI_URL}/run",
            content=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.text.strip()

    async def ebi_status(self, job_id: str) -> str:
        """Poll EBI BLAST job status. Returns the raw status string."""
        client = await self._client()
        resp = await client.get(f"{EBI_URL}/status/{job_id}")
        resp.raise_for_status()
        return resp.text.strip()

    async def ebi_results(self, job_id: str, query_len: int = 1) -> list[dict[str, Any]]:
        """Fetch finished EBI BLAST results and normalise into BlastHit dicts."""
        client = await self._client()
        resp = await client.get(f"{EBI_URL}/result/{job_id}/json", timeout=60.0)
        resp.raise_for_status()
        data = resp.json()
        q_len = int(data.get("query_len") or query_len or 1)
        return self._parse_ebi_hits(data.get("hits", []), q_len)

    def _parse_ebi_hits(
        self, hits: list[dict[str, Any]], query_len: int
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for hit in hits[:50]:
            accession = hit.get("hit_acc", "")
            description = hit.get("hit_desc", hit.get("hit_def", ""))
            hsps: list[dict[str, Any]] = hit.get("hit_hsps", [{}])
            hsp = hsps[0] if hsps else {}

            q_from = int(hsp.get("hsp_query_from", 0))
            q_to = int(hsp.get("hsp_query_to", 0))
            q_cov = (
                min(((q_to - q_from + 1) / query_len) * 100, 100.0)
                if q_to > q_from and query_len > 0
                else 0.0
            )

            results.append(
                {
                    "accession": accession,
                    "description": description,
                    "e_value": float(hsp.get("hsp_expect", 999.0)),
                    "identity_percent": float(hsp.get("hsp_identity", 0.0)),
                    "query_coverage_percent": round(q_cov, 1),
                    "alignment_length": int(hsp.get("hsp_align_len", 0)),
                    "source": "ebi",
                }
            )
        return sorted(results, key=lambda x: x["e_value"])

    # ── UniProt BLAST ─────────────────────────────────────────────────────── #

    async def uniprot_submit(self, sequence: str) -> str:
        """Submit a protein sequence to UniProt BLAST and return the job ID."""
        clean = self.strip_header(sequence)
        client = await self._client()
        resp = await client.post(
            f"{UNIPROT_URL}/blast/run",
            data={
                "sequence": f">Query\n{clean}",
                "ids": "UniProtKB",
                "taxId": "",
            },
        )
        resp.raise_for_status()
        return resp.text.strip()

    async def uniprot_status(self, job_id: str) -> str:
        """Poll UniProt BLAST job status. Returns normalised status string."""
        client = await self._client()
        resp = await client.get(f"{UNIPROT_URL}/blast/status/{job_id}")
        resp.raise_for_status()
        try:
            data = resp.json()
            return str(data.get("status", "RUNNING")).upper()
        except Exception:
            return resp.text.strip().upper()

    async def uniprot_results(
        self, job_id: str, query_len: int = 1
    ) -> list[dict[str, Any]]:
        """Fetch finished UniProt BLAST results in TSV format and normalise."""
        client = await self._client()
        resp = await client.get(
            f"{UNIPROT_URL}/blast/stream/{job_id}",
            params={"format": "tsv"},
            timeout=60.0,
        )
        resp.raise_for_status()
        return self._parse_uniprot_tsv(resp.text, query_len)

    def _parse_uniprot_tsv(
        self, tsv_text: str, query_len: int
    ) -> list[dict[str, Any]]:
        """
        UniProt BLAST TSV columns (0-indexed):
          0  Entry       (accession)
          1  Protein names
          2  Identity %
          3  Alignment length
          4  Mismatches
          5  Gap openings
          6  Query start
          7  Query end
          8  Subject start
          9  Subject end
          10 E-value
          11 Bit score
        """
        results: list[dict[str, Any]] = []
        lines = tsv_text.strip().split("\n")
        if len(lines) < 2:
            return results

        for line in lines[1:51]:
            parts = line.split("\t")
            if len(parts) < 11:
                continue
            try:
                accession = parts[0].strip()
                description = parts[1].strip() if len(parts) > 1 else ""
                identity = float(parts[2]) if len(parts) > 2 else 0.0
                aln_len = int(parts[3]) if len(parts) > 3 else 0
                e_value = float(parts[10]) if len(parts) > 10 else 999.0
                q_start = int(parts[6]) if len(parts) > 6 else 0
                q_end = int(parts[7]) if len(parts) > 7 else 0
                q_cov = (
                    min(((q_end - q_start + 1) / query_len) * 100, 100.0)
                    if q_end > q_start and query_len > 0
                    else 0.0
                )
                results.append(
                    {
                        "accession": accession,
                        "description": description,
                        "e_value": e_value,
                        "identity_percent": identity,
                        "query_coverage_percent": round(q_cov, 1),
                        "alignment_length": aln_len,
                        "source": "uniprot",
                    }
                )
            except (ValueError, IndexError):
                continue

        return sorted(results, key=lambda x: x["e_value"])
