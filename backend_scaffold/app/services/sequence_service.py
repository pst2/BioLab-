from __future__ import annotations

import logging
from collections import Counter
from typing import Any

import httpx
from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from app.bioinformatics.fasta_parser import FastaParser, _IUPAC_COMPLEMENT
from app.clients.blast_client import DEFAULT_DATABASES, BlastClient
from app.clients.ncbi_client import NCBIClient
from app.core.config import settings
from app.data.mock_blast import get_mock_blast_hits
from app.db.models import GeneRecord, SequenceRecord
from app.repositories.cache_repository import CacheRepository
from app.repositories.sequence_cache_repository import SequenceCacheRepository
from app.repositories.sequence_repository import SequenceRepository
from app.schemas.common import ApiResponse, MetaInfo
from app.schemas.sequence import SequenceAnalyzeRequest, SequenceFetchRequest, SequenceSearchRequest
from app.utils.validators import validate_dna_sequence, validate_protein_sequence

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

        # Detect sequence type: protein vs DNA/RNA
        if FastaParser.is_protein_sequence(sequence):
            validate_protein_sequence(sequence)
            result = FastaParser._analyze_protein(sequence)
            result["sequence_type"] = "protein"
            result["dependency_policy"] = {
                "internal_percent": 100,
                "ncbi_percent": 0,
                "note": "Protein analysis is computed by the backend and does not require NCBI.",
            }
            msg = "Protein sequence analyzed locally (Mw, pI, GRAVY, extinction coefficients)"
        else:
            validate_dna_sequence(sequence)
            result = self._build_sequence_analysis(sequence, motifs=payload.motifs)
            result["sequence_type"] = "dna"
            msg = "DNA sequence analyzed locally without NCBI dependency"

        if payload.save and self.sequence_repository:
            saved = self.sequence_repository.create(
                sequence=sequence,
                analysis=result,
                name=payload.name or ("User protein sequence" if result.get("sequence_type") == "protein" else "User DNA sequence"),
                source="user_input",
            )
            result["workspace_record"] = saved
        return ApiResponse(
            success=True,
            message=msg,
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

    def _find_local_sequence(self, accession: str) -> str | None:
        """Find sequence in local DB by accession, symbol, or NCBI ID (local-first policy)."""
        if not self.db:
            return None
        acc = accession.strip()
        clean_acc = acc.split(".")[0]

        # 1. SequenceRecord lookup
        try:
            if self.sequence_repository:
                seq_rec = (
                    self.db.query(SequenceRecord)
                    .filter(
                        (SequenceRecord.name.ilike(acc))
                        | (SequenceRecord.name.ilike(clean_acc))
                    )
                    .first()
                )
                if seq_rec and seq_rec.sequence:
                    return seq_rec.sequence
        except Exception as exc:
            logger.warning("Local SequenceRecord lookup failed for %s: %s", accession, exc)

        # 2. GeneRecord direct fields (symbol, ncbi_gene_id)
        try:
            gene_rec = (
                self.db.query(GeneRecord)
                .filter(
                    (GeneRecord.symbol.ilike(acc))
                    | (GeneRecord.symbol.ilike(clean_acc))
                    | (GeneRecord.ncbi_gene_id == acc)
                    | (GeneRecord.ncbi_gene_id == clean_acc)
                )
                .first()
            )
            if gene_rec and gene_rec.payload and isinstance(gene_rec.payload, dict):
                seq = gene_rec.payload.get("sequence")
                if seq and isinstance(seq, str) and len(seq.strip()) > 0:
                    return seq.strip()
        except Exception as exc:
            logger.warning("Local GeneRecord lookup failed for %s: %s", accession, exc)

        # 3. GeneRecord payload search (genomic_accession, caption, accession inside JSON)
        try:
            gene_rec = (
                self.db.query(GeneRecord)
                .filter(cast(GeneRecord.payload, String).ilike(f"%{clean_acc}%"))
                .first()
            )
            if gene_rec and gene_rec.payload and isinstance(gene_rec.payload, dict):
                seq = gene_rec.payload.get("sequence")
                if seq and isinstance(seq, str) and len(seq.strip()) > 0:
                    return seq.strip()
        except Exception:
            pass

        return None

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

        # Check local database first (local-first policy)
        local_seq = self._find_local_sequence(payload.accession)
        if local_seq:
            raw_text = f">{payload.accession}\n{local_seq}\n"
            parsed = FastaParser.parse(raw_text)
            result = {
                "accession": payload.accession,
                "db": payload.db,
                "format": "fasta",
                "raw": raw_text,
                "parsed": parsed,
                "dependency_policy": "Loaded from local database (local-first)",
            }
            if self.cache_repository:
                self.cache_repository.set(cache_key, result)
            return ApiResponse(
                success=True,
                message="FASTA sequence loaded from local workspace database",
                data=result,
                meta=MetaInfo(source="local", cached=False, stale=False),
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

    async def fetch_raw_fasta_for_igv(
        self,
        accession: str,
        start: int | None = None,
        end: int | None = None,
    ) -> str:
        """Fetch raw FASTA text for IGV.js.

        Returns the FASTA sequence as plain text (not wrapped in ApiResponse).
        Supports optional region slicing via NCBI efetch seq_start/seq_stop params
        (1-based, both inclusive). When no start/end are given the full record is
        returned — be careful with large chromosomes.
        """
        accession = accession.strip()
        if not accession:
            raise ValueError("accession is required")

        # Build a cache key that encodes the region so different windows are cached separately
        region_key = f"{start}-{end}" if (start is not None and end is not None) else "full"
        cache_key = self._build_cache_key("nuccore", accession, f"igv_fasta:{region_key}")

        def normalize_fasta_header(raw_text: str) -> str:
            if raw_text and raw_text.startswith(">"):
                lines = raw_text.splitlines()
                if lines:
                    lines[0] = f">{accession}"
                    return "\n".join(lines)
            return raw_text

        if self.cache_repository:
            cached = self.cache_repository.get_valid(cache_key)
            if cached and isinstance(cached, dict) and cached.get("raw"):
                return normalize_fasta_header(str(cached["raw"]))

        # Check local database first (local-first policy)
        local_seq = self._find_local_sequence(accession)
        if local_seq:
            logger.info("Serving IGV FASTA locally for %s (length=%d)", accession, len(local_seq))
            s_idx = max(0, (start or 1) - 1)
            if s_idx < len(local_seq):
                e_idx = end if (end is not None and end > s_idx) else len(local_seq)
                e_idx = min(e_idx, len(local_seq))
                sliced = local_seq[s_idx:e_idx]
            else:
                sliced = local_seq
            fasta_text = f">{accession}\n{sliced}\n"
            if self.cache_repository:
                self.cache_repository.set(cache_key, {"raw": fasta_text})
            return fasta_text

        try:
            fasta_text = await self.ncbi_client.fetch_sequence_fasta_region(
                accession,
                start=start,
                end=end,
            )
            fasta_text = normalize_fasta_header(fasta_text)

            if self.cache_repository and fasta_text:
                self.cache_repository.set(cache_key, {"raw": fasta_text})
            return fasta_text
        except Exception as exc:
            if self.cache_repository:
                stale = self.cache_repository.get_any(cache_key)
                if stale and isinstance(stale, dict) and stale.get("raw"):
                    logger.warning("Returning stale cache for %s due to fetch error: %s", accession, exc)
                    return normalize_fasta_header(str(stale["raw"]))
            raise

    # Threshold for skipping expensive string outputs
    _LARGE_SEQ_THRESHOLD = 200_000

    def reverse_complement(self, sequence: str) -> str:
        sequence = self._normalize_sequence(sequence)
        validate_dna_sequence(sequence)
        return sequence.translate(_IUPAC_COMPLEMENT)[::-1]

    def transcribe(self, sequence: str) -> str:
        sequence = self._normalize_sequence(sequence)
        validate_dna_sequence(sequence)
        return sequence.replace("T", "U")

    # ── Fast-path versions (skip redundant normalize + validate) ───────── #

    def _reverse_complement_fast(self, sequence: str) -> str:
        """Reverse complement without re-normalising (caller guarantees clean input)."""
        return sequence.translate(_IUPAC_COMPLEMENT)[::-1]

    def _transcribe_fast(self, sequence: str) -> str:
        """Transcribe without re-normalising (caller guarantees clean input)."""
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
        is_large = length > self._LARGE_SEQ_THRESHOLD

        # Use fast-path (sequence already normalised + validated by caller)
        if is_large:
            rev_comp = f"[Truncated — sequence is {length:,} bp]"
            rna_seq = f"[Truncated — sequence is {length:,} bp]"
        else:
            rev_comp = self._reverse_complement_fast(sequence) if sequence else ""
            rna_seq = self._transcribe_fast(sequence) if sequence else ""

        result: dict[str, Any] = {
            "sequence_length": length,
            "gc_content_percent": gc_content,
            "at_content_percent": at_content,
            "base_counts": {base: counts.get(base, 0) for base in ["A", "T", "G", "C", "N"]},
            "base_composition": self._base_composition(counts, length),
            "reverse_complement": rev_comp,
            "rna_sequence": rna_seq,
            "motifs": self._find_motifs(sequence, motifs or ["ATG", "TATA", "AATAAA"], length),
            "orfs": self._find_orfs(sequence, length),
            "codon_frequency": self._codon_frequency(sequence, length),
            "gc_windows": self._gc_windows(sequence, length),
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

    def _find_motifs(self, sequence: str, motifs: list[str], seq_length: int = 0) -> list[dict[str, Any]]:
        # For very large sequences, only search the first 50k bases
        search_seq = sequence[:50_000] if seq_length > 100_000 else sequence
        results = []
        for motif in motifs:
            motif = self._normalize_sequence(motif)
            if not motif:
                continue
            validate_dna_sequence(motif)
            positions = []
            start = 0
            while True:
                idx = search_seq.find(motif, start)
                if idx == -1:
                    break
                positions.append(idx)
                start = idx + 1
            results.append({"motif": motif, "count": len(positions), "positions": positions})
        return results

    def _find_orfs(self, sequence: str, seq_length: int = 0) -> list[dict[str, Any]]:
        """Find ORFs across all 6 reading frames (+1..+3, -1..-3).

        Supports canonical ATG start as well as alternative start codons
        GTG and TTG (NCBI Genetic Code Table 11 — Bacterial/Mitochondrial).
        """
        stop_codons = {"TAA", "TAG", "TGA"}
        start_codons = {"ATG", "GTG", "TTG"}
        # For large sequences, only look for ORFs with minimum length
        min_orf_length = 300 if seq_length > 10_000 else 0
        max_orfs = 50 if seq_length > 10_000 else 100
        orfs: list[dict[str, Any]] = []

        # Build reverse complement for the minus strand
        rev_comp = self._reverse_complement_fast(sequence)

        for strand_label, strand_seq in [('+', sequence), ('-', rev_comp)]:
            strand_len = len(strand_seq)
            for frame_offset in range(3):
                frame_num = frame_offset + 1 if strand_label == '+' else -(frame_offset + 1)
                i = frame_offset
                while i <= strand_len - 3:
                    codon = strand_seq[i : i + 3]
                    if codon in start_codons:
                        j = i + 3
                        while j <= strand_len - 3:
                            stop = strand_seq[j : j + 3]
                            if stop in stop_codons:
                                orf_len = j + 3 - i
                                if orf_len >= min_orf_length:
                                    orfs.append({
                                        "frame": frame_num,
                                        "strand": strand_label,
                                        "start": i,
                                        "end": j + 3,
                                        "length": orf_len,
                                        "start_codon": codon,
                                        "stop_codon": stop,
                                    })
                                break
                            j += 3
                        i = j
                    i += 3
                    if len(orfs) >= max_orfs:
                        break
                if len(orfs) >= max_orfs:
                    break
            if len(orfs) >= max_orfs:
                break
        # Sort by length descending (most biologically significant first)
        orfs.sort(key=lambda x: x["length"], reverse=True)
        return orfs[:max_orfs]

    def _codon_frequency(self, sequence: str, seq_length: int = 0) -> list[dict[str, Any]]:
        # For very large sequences, sample the first 30k bases
        sample = sequence[:30_000] if seq_length > 100_000 else sequence
        counts: Counter = Counter()
        for i in range(0, len(sample) - 2, 3):
            counts[sample[i : i + 3]] += 1
        return [
            {"codon": codon, "count": count}
            for codon, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:30]
        ]

    def _gc_windows(self, sequence: str, seq_length: int = 0) -> list[dict[str, Any]]:
        length = seq_length or len(sequence)
        if length > 50_000:
            window_size = 5_000
        elif length > 5_000:
            window_size = 1_000
        elif length > 500:
            window_size = 100
        else:
            window_size = 20
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

        # Strip FASTA header for length check
        clean_for_len = self.blast_client.strip_header(raw_seq)
        if len(clean_for_len) < 20:
            return ApiResponse(
                success=False,
                message=f"Sequence too short ({len(clean_for_len)} residues). EBI BLAST requires at least 20 residues.",
                data={},
            )

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
            if provider == "uniprot":
                job_id = await self.blast_client.uniprot_submit(
                    raw_seq,
                    database=database,
                    matrix=payload.matrix,
                    exp=payload.evalue_cutoff,
                )
            else:
                job_id = await self.blast_client.ebi_submit(
                    raw_seq,
                    seq_type,
                    database,
                    matrix=payload.matrix,
                    exp=payload.evalue_cutoff,
                    gapopen=payload.gap_open,
                    gapextend=payload.gap_extend,
                )
        except (httpx.HTTPStatusError, httpx.HTTPError) as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code == 400:
                submit_err = (
                    "EBI BLAST rejected the query (HTTP 400). "
                    "Please ensure the sequence is at least 20 residues and contains only valid amino acid or nucleotide characters."
                )
            else:
                submit_err = f"Provider network error: {exc}"

            logger.warning("BLAST submission failed (%s). Checking mock fallback for sequence...", submit_err)
            mock_hits = get_mock_blast_hits(raw_seq, seq_type)
            if mock_hits is not None:
                mock_job_id = f"mock-blast-{abs(hash(raw_seq)) % 10000000}"
                result_data = {
                    "job_id": mock_job_id,
                    "status": "FINISHED",
                    "provider": "local_mock",
                    "sequence_type": seq_type,
                    "database": database,
                    "cache_key": cache_key,
                    "query_len": len(clean_for_len),
                    "hits": mock_hits,
                }
                if self.blast_cache:
                    self.blast_cache.set(cache_key, result_data, ttl_seconds=settings.BLAST_CACHE_TTL_SECONDS)
                    self.blast_cache.set(f"blast:job:{mock_job_id}", result_data, ttl_seconds=7200)
                return ApiResponse(
                    success=True,
                    message="External BLAST service unavailable. Showing bundled reference alignments.",
                    data=result_data,
                    meta=MetaInfo(source="local_mock", cached=False, stale=False, count=len(mock_hits)),
                )

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
