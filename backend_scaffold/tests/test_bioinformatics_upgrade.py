"""Tests for upgraded bioinformatics engine:
- Multi-FASTA parsing
- IUPAC degenerate nucleotide handling
- Protein sequence analysis (Mw, pI, GRAVY)
- 6-frame ORF scanning
"""
from __future__ import annotations

import pytest

from app.bioinformatics.fasta_parser import FastaParser
from app.schemas.sequence import SequenceAnalyzeRequest
from app.services.sequence_service import SequenceService


# ── Multi-FASTA Parsing ───────────────────────────────────────────────────────

def test_multi_fasta_parsing():
    """Multi-record FASTA input produces a list of parsed records."""
    text = ">seq1\nATGCGT\n>seq2\nGCATGC\n>seq3\nTTTAAA"
    result = FastaParser.parse(text)
    assert result["multi_fasta"] is True
    assert result["record_count"] == 3
    assert result["records"][0]["header"] == ">seq1"
    assert result["records"][1]["sequence"] == "GCATGC"
    assert result["records"][2]["sequence_length"] == 6


def test_single_fasta_no_multi_wrapper():
    """Single-record FASTA returns a flat dict (backward compatible)."""
    result = FastaParser.parse(">single\nATGCNN")
    assert "multi_fasta" not in result
    assert result["header"] == ">single"
    assert result["is_dna"] is True


def test_parse_multi_always_returns_list():
    """parse_multi() always returns a list, even for a single record."""
    records = FastaParser.parse_multi(">one\nATGC")
    assert isinstance(records, list)
    assert len(records) == 1
    assert records[0]["sequence"] == "ATGC"


# ── IUPAC Degenerate Nucleotide Handling ──────────────────────────────────────

def test_fasta_parser_accepts_iupac_bases():
    """FASTA parser recognises sequences containing IUPAC degenerate codes."""
    parsed = FastaParser.parse(">iupac\nATGCRYSWKMBDHVN")
    assert parsed["is_dna"] is True
    assert parsed["analysis"]["sequence_length"] == 15


def test_iupac_reverse_complement():
    """Reverse complement correctly maps IUPAC degenerate codes."""
    # R=A/G -> Y=C/T, Y -> R, S -> S, W -> W, K=G/T -> M=A/C, M -> K
    # B=C/G/T -> V=A/C/G, V -> B, D=A/G/T -> H=A/C/T, H -> D
    rc = FastaParser.reverse_complement("ARYSWKMBDHVN")
    # Reverse of the complement
    expected = "NBDHVKMWSRYT"
    assert rc == expected


def test_fasta_parser_gap_character():
    """Gap character '-' is accepted in DNA sequences."""
    parsed = FastaParser.parse(">gapped\nATG-CGT-N")
    assert parsed["is_dna"] is True


# ── Protein Analysis ─────────────────────────────────────────────────────────

def test_fasta_parser_protein_detection():
    """Protein sequences are distinguished from DNA by unique amino acids."""
    parsed = FastaParser.parse(">insulin\nMALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT")
    assert parsed["is_protein"] is True
    assert parsed["is_dna"] is False
    assert parsed["sequence_type"] == "protein"


def test_protein_analysis_metrics():
    """Protein analysis computes Mw, pI, GRAVY, and extinction coefficients."""
    parsed = FastaParser.parse(">test_prot\nMKTLLILAVIMACAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT")
    analysis = parsed["analysis"]
    assert analysis is not None
    assert analysis["sequence_length"] > 0
    assert analysis["molecular_weight_da"] > 0
    assert "theoretical_pi" in analysis
    assert "gravy" in analysis
    assert "amino_acid_counts" in analysis
    assert "amino_acid_groups" in analysis
    # Check group classification exists
    groups = analysis["amino_acid_groups"]
    assert "nonpolar" in groups
    assert "polar" in groups
    assert "acidic" in groups
    assert "basic" in groups
    assert "aromatic" in groups


def test_protein_visualization_data():
    """Protein visualization includes amino acid composition and property distribution."""
    parsed = FastaParser.parse(">viz_prot\nMEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQ")
    viz = parsed["visualization"]
    assert viz is not None
    assert "amino_acid_composition" in viz
    assert "property_distribution" in viz
    assert len(viz["amino_acid_composition"]) > 0
    assert len(viz["property_distribution"]) > 0


# ── 6-Frame ORF Scanning ─────────────────────────────────────────────────────

def test_six_frame_orf_finds_reverse_strand():
    """ORF finder discovers ORFs on the minus strand."""
    # Construct a sequence with no ORF on + strand but one on - strand
    # Reverse complement of "ATGAAATAA" (ATG-AAA-TAA = Met-Lys-Stop) is "TTATTTCAT"
    seq = "TTATTTCAT"
    service = SequenceService()
    orfs = service._find_orfs(seq, len(seq))
    minus_orfs = [o for o in orfs if o["strand"] == "-"]
    assert len(minus_orfs) > 0
    assert minus_orfs[0]["frame"] < 0  # Negative frame number


def test_six_frame_orf_alternative_start_codons():
    """ORF finder recognises GTG and TTG as alternative start codons."""
    # GTG...TAA — an ORF starting with GTG
    seq = "GTGAAAAAATAA"
    service = SequenceService()
    orfs = service._find_orfs(seq, len(seq))
    gtg_orfs = [o for o in orfs if o.get("start_codon") == "GTG"]
    assert len(gtg_orfs) > 0


def test_six_frame_orf_forward_strand():
    """ORF finder correctly identifies forward-strand ORFs."""
    seq = "ATGAAAGCCTGA"  # ATG-AAA-GCC-TGA = Met-Lys-Ala-Stop (12 bp)
    service = SequenceService()
    orfs = service._find_orfs(seq, len(seq))
    plus_orfs = [o for o in orfs if o["strand"] == "+"]
    assert len(plus_orfs) > 0
    # The forward ORF should span the full sequence
    assert any(o["length"] == 12 for o in plus_orfs)


# ── Protein Analysis via SequenceService ──────────────────────────────────────

def test_analyze_protein_via_service():
    """SequenceService.analyze auto-detects protein and returns biochemistry."""
    service = SequenceService()
    result = service.analyze(SequenceAnalyzeRequest(
        sequence="MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAM",
        save=False,
    ))
    assert result.success is True
    assert result.data["sequence_type"] == "protein"
    assert result.data["molecular_weight_da"] > 0
    assert "theoretical_pi" in result.data
    assert "Protein" in result.message


def test_analyze_dna_still_works():
    """DNA analysis path is not broken by the protein detection logic."""
    service = SequenceService()
    result = service.analyze(SequenceAnalyzeRequest(sequence="ATGCGTAC", save=False))
    assert result.data["sequence_type"] == "dna"
    assert result.data["gc_content_percent"] == 50.0
