from __future__ import annotations

import logging
from collections import Counter
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.bioinformatics.fasta_parser import FastaParser
from app.clients.blast_client import DEFAULT_DATABASES, BlastClient
from app.clients.ncbi_client import NCBIClient
from app.core.config import settings
from app.repositories.cache_repository import CacheRepository
from app.repositories.sequence_cache_repository import SequenceCacheRepository
from app.repositories.sequence_repository import SequenceRepository
from app.schemas.common import ApiResponse, MetaInfo
from app.schemas.sequence import SequenceAnalyzeRequest, SequenceFetchRequest, SequenceSearchRequest
from app.utils.validators import validate_dna_sequence

logger = logging.getLogger(__name__)


class SequenceService:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        self.ncbi_client = NCBIClient()
        self.blast_client = BlastClient()
        self.cache_repository = (
            SequenceCacheRepository(db, ttl_seconds=settings.CACHE_TTL_SEQUENCE_SECONDS) if db else None
        )
        self.blast_cache = CacheRepository(db) if db else None
        self.sequence_repository = SequenceRepository(db) if db else None

    def analyze(self, payload: SequenceAnalyzeRequest) -> ApiResponse:
        sequence = self._normalize_sequence(payload.sequence)
        validate_dna_sequence(sequence)
        result = self._build_sequence_analysis(sequence, motifs=payload.motifs)
        if payload.save and self.sequence_repository:
            saved = self.sequence_repository.create(
                sequence=sequence,
                analysis=result,
                name=payload.name or "User DNA sequence",
                source="user_input",
            )
            result["workspace_record"] = saved
        return ApiResponse(
            success=True,
            message="Sequence analyzed locally without NCBI dependency",
            data=result,
            meta=MetaInfo(source="internal", cached=False, stale=False),
        )

    def list_local_sequences(self, limit: int = 20) -> ApiResponse:
        items = self.sequence_repository.recent(limit=limit) if self.sequence_repository else []
        return ApiResponse(
            success=True,
            message="Local sequence workspace records loaded successfully",
            data=items,
            meta=MetaInfo(source="internal", cached=False, stale=False, count=len(items)),
        )

    async def fetch_fasta(self, payload: SequenceFetchRequest) -> ApiResponse:
        cache_key = self._build_cache_key(payload.db, payload.accession, "fasta")
        cached = self.cache_repository.get_valid(cache_key) if self.cache_repository else None
        if cached:
            return ApiResponse(
                success=True,
                message="FASTA sequence loaded from local cache",
                data=cached,
                meta=MetaInfo(source="cache", cached=True, stale=False),
            )

        try:
            fasta_text = await self.ncbi_client.fetch_sequence_fasta(payload.accession, payload.db)
            parsed = FastaParser.parse(fasta_text)
            result = {
                "accession": payload.accession,
                "db": payload.db,
                "format": "fasta",
                "raw": fasta_text,
                "parsed": parsed,
                "dependency_policy": "NCBI fetch is optional; parsed sequence analysis is computed internally",
            }
            if self.cache_repository:
                self.cache_repository.set(cache_key, result)
            if parsed.get("is_dna") and parsed.get("analysis") and self.sequence_repository:
                self.sequence_repository.create(
                    sequence=parsed["sequence"],
                    analysis=parsed["analysis"],
                    name=payload.accession,
                    source="ncbi_import",
                )
            return ApiResponse(
                success=True,
                message="FASTA sequence fetched from NCBI, cached locally, and parsed internally",
                data=result,
                meta=MetaInfo(source="ncbi", cached=False, stale=False),
            )
        except httpx.HTTPError:
            stale_cache = self.cache_repository.get_any(cache_key) if self.cache_repository else None
            if stale_cache:
                return ApiResponse(
                    success=True,
                    message="NCBI unavailable, stale FASTA cache returned",
                    data=stale_cache,
                    meta=MetaInfo(source="cache", cached=True, stale=True),
                )
            return ApiResponse(
                success=False,
                message="NCBI unavailable and no FASTA cache found",
                data={"accession": payload.accession, "db": payload.db, "format": "fasta"},
                meta=MetaInfo(source="ncbi", cached=False, stale=False),
            )

    async def fetch_genbank(self, payload: SequenceFetchRequest) -> ApiResponse:
        cache_key = self._build_cache_key(payload.db, payload.accession, "genbank")
        cached = self.cache_repository.get_valid(cache_key) if self.cache_repository else None
        if cached:
            return ApiResponse(
                success=True,
                message="GenBank record loaded from local cache",
                data=cached,
                meta=MetaInfo(source="cache", cached=True, stale=False),
            )

        try:
            genbank_text = await self.ncbi_client.fetch_sequence_genbank(payload.accession, payload.db)
            result = {
                "accession": payload.accession,
                "db": payload.db,
                "format": "genbank",
                "raw": genbank_text,
                "dependency_policy": "NCBI fetch is optional and cached locally",
            }
            if self.cache_repository:
                self.cache_repository.set(cache_key, result)
            return ApiResponse(
                success=True,
                message="GenBank record fetched successfully and cached locally",
                data=result,
                meta=MetaInfo(source="ncbi", cached=False, stale=False),
            )
        except httpx.HTTPError:
            stale_cache = self.cache_repository.get_any(cache_key) if self.cache_repository else None
            if stale_cache:
                return ApiResponse(
                    success=True,
                    message="NCBI unavailable, stale GenBank cache returned",
                    data=stale_cache,
                    meta=MetaInfo(source="cache", cached=True, stale=True),
                )
            return ApiResponse(
                success=False,
                message="NCBI unavailable and no GenBank cache found",
                data={"accession": payload.accession, "db": payload.db, "format": "genbank"},
                meta=MetaInfo(source="ncbi", cached=False, stale=False),
            )

    def reverse_complement(self, sequence: str) -> str:
        sequence = self._normalize_sequence(sequence)
        validate_dna_sequence(sequence)
        complement_map = str.maketrans({"A": "T", "T": "A", "G": "C", "C": "G", "N": "N"})
        return sequence.translate(complement_map)[::-1]

    def transcribe(self, sequence: str) -> str:
        sequence = self._normalize_sequence(sequence)
        validate_dna_sequence(sequence)
        return sequence.replace("T", "U")

    def _normalize_sequence(self, sequence: str) -> str:
        return sequence.upper().replace("\n", "").replace("\r", "").replace(" ", "")

    def _build_sequence_analysis(self, sequence: str, motifs: list[str] | None = None) -> dict[str, Any]:
        counts = Counter(sequence)
        length = len(sequence)
        gc_count = counts.get("G", 0) + counts.get("C", 0)
        at_count = counts.get("A", 0) + counts.get("T", 0)
        gc_content = round((gc_count / length) * 100, 2) if length else 0.0
        at_content = round((at_count / length) * 100, 2) if length else 0.0
        result: dict[str, Any] = {
            "sequence_length": length,
            "gc_content_percent": gc_content,
            "at_content_percent": at_content,
            "base_counts": {base: counts.get(base, 0) for base in ["A", "T", "G", "C", "N"]},
            "base_composition": self._base_composition(counts, length),
            "reverse_complement": self.reverse_complement(sequence) if sequence else "",
            "rna_sequence": self.transcribe(sequence) if sequence else "",
            "motifs": self._find_motifs(sequence, motifs or ["ATG", "TATA", "AATAAA"]),
            "orfs": self._find_orfs(sequence),
            "codon_frequency": self._codon_frequency(sequence),
            "gc_windows": self._gc_windows(sequence),
            "dependency_policy": {
                "internal_percent": 100,
                "ncbi_percent": 0,
                "note": "Sequence analysis is computed by the backend and does not require NCBI.",
            },
        }
        return result

    def _base_composition(self, counts: Counter, length: int) -> list[dict[str, Any]]:
        return [
            {
                "base": base,
                "count": counts.get(base, 0),
                "percentage": round((counts.get(base, 0) / length) * 100, 2) if length else 0.0,
            }
            for base in ["A", "T", "G", "C", "N"]
        ]

    def _find_motifs(self, sequence: str, motifs: list[str]) -> list[dict[str, Any]]:
        results = []
        for motif in motifs:
            motif = self._normalize_sequence(motif)
            if not motif:
                continue
            validate_dna_sequence(motif)
            positions = []
            start = 0
            while True:
                idx = sequence.find(motif, start)
                if idx == -1:
                    break
                positions.append(idx)
                start = idx + 1
            results.append({"motif": motif, "count": len(positions), "positions": positions})
        return results

    def _find_orfs(self, sequence: str) -> list[dict[str, Any]]:
        stop_codons = {"TAA", "TAG", "TGA"}
        orfs = []
        for frame in range(3):
            i = frame
            while i <= len(sequence) - 3:
                codon = sequence[i : i + 3]
                if codon == "ATG":
                    j = i + 3
                    while j <= len(sequence) - 3:
                        stop = sequence[j : j + 3]
                        if stop in stop_codons:
                            orfs.append({"frame": frame + 1, "start": i, "end": j + 3, "length": j + 3 - i, "stop_codon": stop})
                            break
                        j += 3
                    i = j
                i += 3
        return orfs[:50]

    def _codon_frequency(self, sequence: str) -> list[dict[str, Any]]:
        codons = [sequence[i : i + 3] for i in range(0, len(sequence) - 2, 3)]
        counts = Counter(codons)
        return [
            {"codon": codon, "count": count}
            for codon, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:30]
        ]

    def _gc_windows(self, sequence: str, window_size: int = 20) -> list[dict[str, Any]]:
        if len(sequence) > 500:
            window_size = 100
        if len(sequence) > 5000:
            window_size = 1000
        windows = []
        for start in range(0, len(sequence), window_size):
            window = sequence[start : start + window_size]
            if not window:
                continue
            gc = window.count("G") + window.count("C")
            windows.append({
                "start": start,
                "end": start + len(window),
                "gc_content_percent": round((gc / len(window)) * 100, 2),
            })
        return windows

    def _build_cache_key(self, db: str, accession: str, fmt: str) -> str:
        return f"sequence:{db}:{accession}:{fmt}".lower()

    # ── BLAST Similarity Search ────────────────────────────────────────────── #

    async def submit_similarity_search(self, payload: SequenceSearchRequest) -> ApiResponse:
        """Submit a BLAST similarity-search job with multi-provider auto-fallback."""
        raw_seq = payload.sequence.strip()
        if not raw_seq:
            return ApiResponse(success=False, message="Sequence cannot be empty", data={})

        # Auto-detect sequence type when requested
        seq_type = payload.sequence_type
        if seq_type == "auto":
            seq_type = self.blast_client.detect_type(raw_seq)

        # Resolve provider and database
        requested_provider = payload.provider
        provider = requested_provider if requested_provider != "auto" else "ebi"

        database = payload.database or DEFAULT_DATABASES.get(provider, {}).get(seq_type, "uniprotkb_swissprot")

        # UniProt BLAST is protein-only
        if provider == "uniprot" and seq_type != "protein":
            return ApiResponse(
                success=False,
                message="UniProt BLAST supports protein sequences only. Use provider='ebi' or 'auto' for DNA.",
                data={},
            )

        # Check cache for a previously-finished result
        cache_key = self.blast_client.make_cache_key(raw_seq, seq_type, database, provider)
        if self.blast_cache:
            cached = self.blast_cache.get_valid(cache_key)
            if cached and cached.get("status") == "FINISHED":
                return ApiResponse(
                    success=True,
                    message=f"Results loaded from cache ({len(cached.get('hits', []))} hits)",
                    data=cached,
                    meta=MetaInfo(source="cache", cached=True, stale=False),
                )

        # Submit to provider with auto-fallback
        job_id: str | None = None
        actual_provider = provider
        submit_err: str = ""

        try:
            if provider == "ebi":
                job_id = await self.blast_client.ebi_submit(raw_seq, seq_type, database)
            else:  # uniprot
                job_id = await self.blast_client.uniprot_submit(raw_seq)
        except httpx.HTTPError as exc:
            submit_err = str(exc)
            # Auto-fallback: EBI failed → try UniProt (protein only)
            if requested_provider == "auto" and seq_type == "protein":
                try:
                    job_id = await self.blast_client.uniprot_submit(raw_seq)
                    actual_provider = "uniprot"
                    database = "UniProtKB"
                    submit_err = ""
                except httpx.HTTPError as exc2:
                    return ApiResponse(
                        success=False,
                        message=f"All BLAST providers failed. EBI: {submit_err}. UniProt: {exc2}",
                        data={},
                    )
            else:
                return ApiResponse(
                    success=False,
                    message=f"BLAST submission failed: {submit_err}",
                    data={},
                )

        if not job_id:
            return ApiResponse(success=False, message=f"BLAST submission failed: {submit_err}", data={})

        # Compute query length for coverage calculation later
        clean_seq = self.blast_client.strip_header(raw_seq)
        query_len = len(clean_seq)

        job_meta: dict = {
            "job_id": job_id,
            "status": "RUNNING",
            "provider": actual_provider,
            "sequence_type": seq_type,
            "database": database,
            "cache_key": cache_key,
            "query_len": query_len,
        }

        # Persist job metadata so the status endpoint can look it up
        if self.blast_cache:
            self.blast_cache.set(f"blast:job:{job_id}", job_meta, ttl_seconds=7200)

        return ApiResponse(
            success=True,
            message=f"BLAST job submitted successfully. Provider: {actual_provider}. Job ID: {job_id}",
            data=job_meta,
            meta=MetaInfo(source=actual_provider, cached=False, stale=False),
        )

    async def check_similarity_search_status(self, job_id: str) -> ApiResponse:
        """Poll BLAST job status and return results when finished."""
        # Load job metadata
        job_meta: dict | None = None
        if self.blast_cache:
            job_meta = self.blast_cache.get_any(f"blast:job:{job_id}")

        if not job_meta:
            return ApiResponse(
                success=False,
                message="Job not found or expired (jobs are retained for 2 hours).",
                data={"job_id": job_id, "status": "NOT_FOUND"},
            )

        provider = job_meta.get("provider", "ebi")
        cache_key: str = job_meta.get("cache_key", "")
        query_len: int = int(job_meta.get("query_len", 1) or 1)

        # Return cached finished results immediately
        if cache_key and self.blast_cache:
            cached = self.blast_cache.get_valid(cache_key)
            if cached and cached.get("status") == "FINISHED":
                return ApiResponse(
                    success=True,
                    message=f"Results loaded from cache ({len(cached.get('hits', []))} hits)",
                    data=cached,
                    meta=MetaInfo(source="cache", cached=True, stale=False),
                )

        # Poll the appropriate provider
        try:
            if provider == "ebi":
                raw_status = await self.blast_client.ebi_status(job_id)
            else:
                raw_status = await self.blast_client.uniprot_status(job_id)
        except httpx.HTTPError as exc:
            return ApiResponse(
                success=False,
                message=f"Failed to poll job status: {exc}",
                data={"job_id": job_id, "status": "ERROR"},
            )

        # Normalise status string across providers
        STATUS_MAP = {
            "FINISHED": "FINISHED",
            "RUNNING": "RUNNING",
            "PENDING": "PENDING",
            "QUEUED": "PENDING",
            "ERROR": "ERROR",
            "FAILURE": "ERROR",
            "FAILED": "ERROR",
            "NOT_FOUND": "NOT_FOUND",
        }
        status = STATUS_MAP.get(raw_status.upper(), "RUNNING")

        if status == "FINISHED":
            # Retrieve and cache the results
            try:
                if provider == "ebi":
                    hits = await self.blast_client.ebi_results(job_id, query_len)
                else:
                    hits = await self.blast_client.uniprot_results(job_id, query_len)

                result_data = {**job_meta, "status": "FINISHED", "hits": hits}

                if self.blast_cache and cache_key:
                    self.blast_cache.set(
                        cache_key,
                        result_data,
                        ttl_seconds=settings.BLAST_CACHE_TTL_SECONDS,
                    )

                return ApiResponse(
                    success=True,
                    message=f"Search complete. Found {len(hits)} hits.",
                    data=result_data,
                    meta=MetaInfo(source=provider, cached=False, stale=False, count=len(hits)),
                )
            except Exception as exc:
                logger.error("Failed to fetch BLAST results for job %s: %s", job_id, exc)
                return ApiResponse(
                    success=False,
                    message=f"Failed to retrieve results: {exc}",
                    data={"job_id": job_id, "status": "ERROR"},
                )

        if status in ("ERROR", "NOT_FOUND"):
            return ApiResponse(
                success=False,
                message=f"BLAST job {status.lower()}.",
                data={"job_id": job_id, "status": status},
            )

        # Still running / pending
        return ApiResponse(
            success=True,
            message=f"Job status: {status}",
            data={**job_meta, "status": status},
            meta=MetaInfo(source=provider, cached=False, stale=False),
        )
