from __future__ import annotations

from collections import Counter
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.bioinformatics.fasta_parser import FastaParser
from app.clients.ncbi_client import NCBIClient
from app.core.config import settings
from app.repositories.sequence_cache_repository import SequenceCacheRepository
from app.repositories.sequence_repository import SequenceRepository
from app.schemas.common import ApiResponse, MetaInfo
from app.schemas.sequence import SequenceAnalyzeRequest, SequenceFetchRequest
from app.utils.validators import validate_dna_sequence


class SequenceService:
    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        self.ncbi_client = NCBIClient()
        self.cache_repository = (
            SequenceCacheRepository(db, ttl_seconds=settings.CACHE_TTL_SEQUENCE_SECONDS) if db else None
        )
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
