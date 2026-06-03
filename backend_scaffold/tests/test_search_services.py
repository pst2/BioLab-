from __future__ import annotations

import pytest

from app.core.exceptions import ServiceUnavailableException
from app.services.gene_service import GeneService
from app.services.pubmed_service import PubMedService


@pytest.mark.asyncio
async def test_gene_search_cache_hit_calls_ncbi_once(db_session, monkeypatch):
    calls = {"count": 0}

    async def fake_search(keyword):
        calls["count"] += 1
        return [{"gene_id": "1", "symbol": "BRCA1"}]

    service = GeneService(db_session)
    monkeypatch.setattr(service.ncbi_client, "search_genes", fake_search)

    first = await service.search_genes("BRCA1")
    second = await service.search_genes("BRCA1")

    assert calls["count"] == 1
    assert first["meta"]["source"] == "ncbi"
    assert second["meta"]["source"] == "cache"


@pytest.mark.asyncio
async def test_gene_search_uses_stale_cache_when_ncbi_down(db_session, monkeypatch):
    service = GeneService(db_session)
    service.cache_repo.set("gene_search:v3:brca1", [{"symbol": "BRCA1"}], ttl_seconds=-1)

    async def fake_search(**kwargs):
        raise RuntimeError("NCBI down")

    monkeypatch.setattr(service.provider_orchestrator, "search_with_fallbacks", fake_search)
    result = await service.search_genes("BRCA1")
    assert result["meta"]["source"] == "cache"
    assert result["meta"]["stale"] is True


@pytest.mark.asyncio
async def test_gene_search_uses_mock_data_when_available(db_session, monkeypatch):
    service = GeneService(db_session)

    async def fake_search(**kwargs):
        raise RuntimeError("NCBI down")

    monkeypatch.setattr(service.provider_orchestrator, "search_with_fallbacks", fake_search)
    result = await service.search_genes("tp53")
    assert result["meta"]["source"] == "local_mock"


@pytest.mark.asyncio
async def test_gene_search_raises_503_without_cache_or_mock(db_session, monkeypatch):
    service = GeneService(db_session)

    async def fake_search(**kwargs):
        raise RuntimeError("NCBI down")

    monkeypatch.setattr(service.provider_orchestrator, "search_with_fallbacks", fake_search)
    with pytest.raises(ServiceUnavailableException):
        await service.search_genes("definitely-not-in-mock")




@pytest.mark.asyncio
async def test_gene_search_uses_provider_fallback_when_ncbi_down(db_session, monkeypatch):
    service = GeneService(db_session)

    async def fake_provider_search(**kwargs):
        return [
            {
                "id": "ENSG00000012048",
                "gene_id": "ENSG00000012048",
                "symbol": "BRCA1",
                "name": "BRCA1",
                "description": "BRCA1 DNA repair associated",
                "organism": "homo_sapiens",
                "source": "ensembl",
            }
        ]

    monkeypatch.setattr(service.provider_orchestrator, "search_with_fallbacks", fake_provider_search)
    result = await service.search_genes("BRCA1", mode="external_refresh")
    assert result["meta"]["source"] == "ensembl"
    assert result["data"][0]["source"] == "ensembl"


@pytest.mark.asyncio
async def test_pubmed_search_cache_hit(db_session, monkeypatch):
    calls = {"count": 0}
    service = PubMedService(db_session)

    async def fake_search(keyword):
        calls["count"] += 1
        return [{"pmid": "123", "title": "Paper"}]

    monkeypatch.setattr(service.ncbi_client, "search_pubmed", fake_search)
    await service.search_pubmed("cancer")
    cached = await service.search_pubmed("cancer")
    assert calls["count"] == 1
    assert cached["meta"]["source"] == "cache"


@pytest.mark.asyncio
async def test_pubmed_search_raises_when_no_fallback(db_session, monkeypatch):
    service = PubMedService(db_session)

    async def fake_search(**kwargs):
        raise RuntimeError("NCBI down")

    monkeypatch.setattr(service.ncbi_client, "search_pubmed", fake_search)
    with pytest.raises(ServiceUnavailableException):
        await service.search_pubmed("definitely-not-in-mock")
