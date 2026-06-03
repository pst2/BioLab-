from __future__ import annotations

import pytest

from app.clients.ncbi_client import NCBIClient


@pytest.mark.asyncio
async def test_search_genes_uses_esummary(monkeypatch):
    client = NCBIClient()

    async def fake_get_json(endpoint, params):
        if endpoint == "esearch.fcgi":
            return {"esearchresult": {"idlist": ["1"]}}
        return {
            "result": {
                "1": {
                    "uid": "1",
                    "name": "BRCA1",
                    "description": "BRCA1 DNA repair associated",
                    "summary": "Tumor suppressor gene",
                    "organism": {"scientificname": "Homo sapiens"},
                }
            }
        }

    monkeypatch.setattr(client, "_get_json", fake_get_json)
    result = await client.search_genes("BRCA1")
    assert result[0]["symbol"] == "BRCA1"
    assert result[0]["organism"] == "Homo sapiens"
    assert "Gene result" not in result[0]["name"]


@pytest.mark.asyncio
async def test_search_pubmed_extracts_authors_and_doi(monkeypatch):
    client = NCBIClient()

    async def fake_get_json(endpoint, params):
        if endpoint == "esearch.fcgi":
            return {"esearchresult": {"idlist": ["123"]}}
        return {
            "result": {
                "123": {
                    "uid": "123",
                    "title": "Example paper",
                    "source": "Nature",
                    "pubdate": "2026",
                    "authors": [{"name": "Nguyen A"}, {"name": "Tran B"}],
                    "articleids": [{"idtype": "doi", "value": "10.1000/example"}],
                }
            }
        }

    monkeypatch.setattr(client, "_get_json", fake_get_json)
    result = await client.search_pubmed("shrimp genome")
    assert result[0]["authors"] == ["Nguyen A", "Tran B"]
    assert result[0]["doi"] == "10.1000/example"


@pytest.mark.asyncio
async def test_fetch_sequence_fasta_uses_text_endpoint(monkeypatch):
    client = NCBIClient()

    async def fake_get_text(endpoint, params):
        assert endpoint == "efetch.fcgi"
        assert params["rettype"] == "fasta"
        return ">x\nATGC"

    monkeypatch.setattr(client, "_get_text", fake_get_text)
    assert await client.fetch_sequence_fasta("NC_1") == ">x\nATGC"


@pytest.mark.asyncio
async def test_ping_returns_true(monkeypatch):
    client = NCBIClient()

    async def fake_get_json(endpoint, params):
        return {"ok": True}

    monkeypatch.setattr(client, "_get_json", fake_get_json)
    assert await client.ping() is True


def test_extract_pubmed_doi_missing_returns_none():
    client = NCBIClient()
    assert client._extract_pubmed_doi({"articleids": []}) is None
