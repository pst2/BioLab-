from __future__ import annotations

import httpx
import pytest

from app.bioinformatics.fasta_parser import FastaParser
from app.schemas.sequence import SequenceAnalyzeRequest, SequenceFetchRequest
from app.services.sequence_service import SequenceService


def test_sequence_analyze_returns_gc_and_counts():
    service = SequenceService()
    result = service.analyze(SequenceAnalyzeRequest(sequence="ATGCGTAC"))
    assert result.data["sequence_length"] == 8
    assert result.data["gc_content_percent"] == 50.0
    assert result.data["reverse_complement"] == "GTACGCAT"


def test_fasta_parser_returns_visualization_data():
    parsed = FastaParser.parse(">seq1\nATGCNN")
    assert parsed["header"] == ">seq1"
    assert parsed["is_dna"] is True
    assert parsed["visualization"]["base_composition"][0]["base"] == "A"


def test_fasta_parser_rejects_non_dna_analysis():
    parsed = FastaParser.parse(">protein\nMEEPQ")
    assert parsed["is_dna"] is False
    assert parsed["analysis"] is None


@pytest.mark.asyncio
async def test_fetch_fasta_cache_hit_calls_ncbi_once(db_session, monkeypatch):
    calls = {"count": 0}
    service = SequenceService(db_session)

    async def fake_fetch(accession, db):
        calls["count"] += 1
        return ">NC_1\nATGC"

    monkeypatch.setattr(service.ncbi_client, "fetch_sequence_fasta", fake_fetch)
    payload = SequenceFetchRequest(accession="NC_1", db="nuccore")
    first = await service.fetch_fasta(payload)
    second = await service.fetch_fasta(payload)
    assert calls["count"] == 1
    assert first.meta.source == "ncbi"
    assert second.meta.source == "cache"


@pytest.mark.asyncio
async def test_fetch_fasta_returns_stale_cache_when_ncbi_down(db_session, monkeypatch):
    service = SequenceService(db_session)
    cache_key = service._build_cache_key("nuccore", "NC_1", "fasta")
    service.cache_repository.cache_repo.set(cache_key, {"raw": ">old\nATGC"}, ttl_seconds=-1)

    async def fake_fetch(accession, db):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(service.ncbi_client, "fetch_sequence_fasta", fake_fetch)
    result = await service.fetch_fasta(SequenceFetchRequest(accession="NC_1", db="nuccore"))
    assert result.meta.source == "cache"
    assert result.meta.stale is True


@pytest.mark.asyncio
async def test_fetch_genbank_cache_hit(db_session, monkeypatch):
    calls = {"count": 0}
    service = SequenceService(db_session)

    async def fake_fetch(accession, db):
        calls["count"] += 1
        return "LOCUS test"

    monkeypatch.setattr(service.ncbi_client, "fetch_sequence_genbank", fake_fetch)
    payload = SequenceFetchRequest(accession="NC_1", db="nuccore")
    await service.fetch_genbank(payload)
    cached = await service.fetch_genbank(payload)
    assert calls["count"] == 1
    assert cached.meta.source == "cache"


@pytest.mark.asyncio
async def test_fetch_genbank_returns_failure_without_cache(db_session, monkeypatch):
    service = SequenceService(db_session)

    async def fake_fetch(accession, db):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(service.ncbi_client, "fetch_sequence_genbank", fake_fetch)
    result = await service.fetch_genbank(SequenceFetchRequest(accession="NC_404", db="nuccore"))
    assert result.success is False
