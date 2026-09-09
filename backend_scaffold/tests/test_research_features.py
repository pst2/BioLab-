"""
test_research_features.py — Automated verification for Phase 2, 3, and 4 upgrades:
  - Export routes: FASTA, GenBank (.gb), BED, JSON, Search CSV
  - Citation routes: BibTeX, RIS
  - BLAST HSP alignment parsing
  - Database FAIR provenance columns & metadata
"""
from __future__ import annotations

import pytest
from app.api.routes.export import (
    export_bibtex,
    export_gene_bed,
    export_gene_fasta,
    export_gene_genbank,
    export_gene_json,
    export_ris,
    export_search_csv,
)
from app.clients.blast_client import BlastClient
from app.db.models import GeneRecord, SequenceRecord
from app.repositories.gene_repository import GeneRepository
from app.services.gene_service import GeneService


@pytest.fixture
def sample_gene(db_session):
    repo = GeneRepository(db_session)
    item = {
        "symbol": "BRCA1",
        "name": "BRCA1 DNA repair associated",
        "description": "Breast cancer 1 susceptibility protein",
        "organism": "Homo sapiens",
        "gene_id": "672",
        "chromosome": "17",
        "start": 43044295,
        "end": 43125483,
        "strand": "-",
        "sequence": "ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTAGAGTGTCCCATCTGTCTGGAGTTGATCAAGGAACCTGTCTCCACAAAGTGTGACCACATATTTTGCAAATTTTGCATGCTGAAACTTCTCAACCAGAAGAAAGGGCCTTCACAGTGTCCTTTATGTAAGAATGATATAACCAAAAGG",
        "genome_assembly": "GRCh38.p14",
        "taxid": 9606,
        "accession_version": "NC_000017.11",
    }
    repo.upsert(item, source="ncbi")
    db_session.commit()
    return item


# ── Phase 2: Export Endpoints ─────────────────────────────────────────────────

def test_export_gene_fasta(db_session, sample_gene):
    resp = export_gene_fasta("672", db=db_session)
    assert resp.status_code == 200
    content = resp.body.decode("utf-8")
    assert content.startswith(">BRCA1 |")
    assert "Homo sapiens" in content
    assert "ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTA" in content
    assert 'attachment; filename="BRCA1_672.fasta"' in resp.headers["Content-Disposition"]


def test_export_gene_json(db_session, sample_gene):
    resp = export_gene_json("672", db=db_session)
    assert resp.status_code == 200
    content = resp.body.decode("utf-8")
    assert '"symbol": "BRCA1"' in content
    assert '"organism": "Homo sapiens"' in content
    assert 'attachment; filename="BRCA1_672.json"' in resp.headers["Content-Disposition"]


def test_export_gene_genbank(db_session, sample_gene):
    resp = export_gene_genbank("672", db=db_session)
    assert resp.status_code == 200
    content = resp.body.decode("utf-8")
    assert "LOCUS       BRCA1" in content
    assert "DEFINITION  BRCA1 DNA repair associated." in content
    assert "SOURCE      Homo sapiens" in content
    assert "FEATURES             Location/Qualifiers" in content
    assert "/gene=\"BRCA1\"" in content
    assert "ORIGIN" in content
    assert "//" in content
    assert 'attachment; filename="BRCA1_672.gb"' in resp.headers["Content-Disposition"]


def test_export_gene_bed(db_session, sample_gene):
    resp = export_gene_bed("672", db=db_session)
    assert resp.status_code == 200
    content = resp.body.decode("utf-8")
    assert "track name=\"BRCA1\"" in content
    assert "chr17" in content
    assert "43044294" in content  # 0-based start
    assert 'attachment; filename="BRCA1_672.bed"' in resp.headers["Content-Disposition"]


def test_export_search_csv(db_session, sample_gene):
    resp = export_search_csv("BRCA1", db=db_session)
    assert resp.status_code == 200
    content = resp.body.decode("utf-8")
    assert "gene_id,symbol,name,organism,chromosome,start,end,source" in content
    assert "BRCA1" in content
    assert "Homo sapiens" in content


def test_export_bibtex():
    resp = export_bibtex(
        pmid="38123456",
        title="Comprehensive CRISPR Screen in Cancer Cells",
        authors="Doudna J, Charpentier E",
        journal="Science",
        year="2024",
        doi="10.1126/science.12345",
    )
    assert resp.status_code == 200
    content = resp.body.decode("utf-8")
    assert "@article{Doudna2024_38123456" in content
    assert "title     = {Comprehensive CRISPR Screen in Cancer Cells}" in content
    assert "pmid      = {38123456}" in content


def test_export_ris():
    resp = export_ris(
        pmid="38123456",
        title="Comprehensive CRISPR Screen in Cancer Cells",
        authors="Doudna J, Charpentier E",
        journal="Science",
        year="2024",
        doi="10.1126/science.12345",
        abstract="We performed genome-scale CRISPR screens to identify novel cancer dependencies.",
    )
    assert resp.status_code == 200
    content = resp.body.decode("utf-8")
    assert "TY  - JOUR" in content
    assert "TI  - Comprehensive CRISPR Screen in Cancer Cells" in content
    assert "AU  - Doudna J" in content
    assert "AU  - Charpentier E" in content
    assert "AN  - PMID:38123456" in content
    assert "AB  - We performed genome-scale CRISPR screens" in content
    assert "ER  -" in content


# ── Phase 3: BLAST Alignment Extraction ───────────────────────────────────────

def test_parse_ebi_hits_with_alignment():
    client = BlastClient()
    mock_hits = [
        {
            "hit_acc": "P04637",
            "hit_desc": "Cellular tumor antigen p53",
            "hit_hsps": [
                {
                    "hsp_expect": "1e-50",
                    "hsp_identity": 98.5,
                    "hsp_align_len": 200,
                    "hsp_bits": 412.5,
                    "hsp_gaps": 2,
                    "hsp_query_from": 1,
                    "hsp_query_to": 200,
                    "hsp_hit_from": 1,
                    "hsp_hit_to": 200,
                    "hsp_qseq": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP",
                    "hsp_mseq": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP",
                    "hsp_hseq": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP",
                }
            ],
        }
    ]
    parsed = client._parse_ebi_hits(mock_hits, query_len=200)
    assert len(parsed) == 1
    hit = parsed[0]
    assert hit["accession"] == "P04637"
    assert hit["bit_score"] == 412.5
    assert hit["gaps"] == 2
    assert hit["query_seq"].startswith("MEEPQ")
    assert hit["match_seq"].startswith("MEEPQ")
    assert hit["subject_seq"].startswith("MEEPQ")
    assert hit["query_from"] == 1
    assert hit["query_to"] == 200


def test_parse_uniprot_tsv_with_alignment():
    client = BlastClient()
    tsv = """Entry\tProtein names\tIdentity %\tAlignment length\tMismatches\tGap openings\tQuery start\tQuery end\tSubject start\tSubject end\tE-value\tBit score
P04637\tCellular tumor antigen p53\t100.0\t393\t0\t0\t1\t393\t1\t393\t0.0\t815
"""
    parsed = client._parse_uniprot_tsv(tsv, query_len=393)
    assert len(parsed) == 1
    hit = parsed[0]
    assert hit["accession"] == "P04637"
    assert hit["bit_score"] == 815.0
    assert hit["gaps"] == 0
    assert hit["query_from"] == 1
    assert hit["query_to"] == 393
    assert hit["hit_from"] == 1
    assert hit["hit_to"] == 393


# ── Phase 4: Provenance & FAIR Metadata ───────────────────────────────────────

def test_db_models_fair_provenance_columns(db_session, sample_gene):
    repo = GeneRepository(db_session)
    record = repo.get_by_gene_id("672")
    assert record["genome_assembly"] == "GRCh38.p14"
    assert record["taxid"] == 9606
    assert record["accession_version"] == "NC_000017.11"


@pytest.mark.asyncio
async def test_search_service_provenance_metadata(db_session, sample_gene):
    service = GeneService(db_session)
    resp = await service.search_genes("BRCA1", mode="local_only")
    assert resp["success"] is True
    assert "provenance" in resp["meta"]
    prov = resp["meta"]["provenance"]
    assert prov["source_provider"] == "local_db"
    assert prov["is_synthetic"] is False
    assert prov["data_integrity"] == "verified"
    assert "retrieved_at" in prov
