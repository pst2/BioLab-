"""
fasta_parser.py — Bioinformatics FASTA parser with:
  - Multi-FASTA support (multiple records per file)
  - Full IUPAC degenerate nucleotide handling
  - Protein sequence analysis (Mw, pI, GRAVY, extinction coefficient)
  - GC skew with adaptive windowing
"""
from __future__ import annotations

from collections import Counter
from typing import Any

# Threshold above which we skip expensive string-transform outputs
# (reverse_complement, transcribe) to keep response times fast.
_LARGE_SEQ_THRESHOLD = 200_000

# Full IUPAC complement table (including degenerate codes)
_IUPAC_COMPLEMENT = str.maketrans({
    "A": "T", "T": "A", "G": "C", "C": "G", "N": "N",
    "R": "Y", "Y": "R", "S": "S", "W": "W",
    "K": "M", "M": "K", "B": "V", "V": "B",
    "D": "H", "H": "D", "U": "A",
    "-": "-",
})

# Canonical DNA bases (excludes degenerate chars) for precise GC/AT counting
_CANONICAL_DNA = frozenset("ATGCN")

# Amino acid property groups
_AA_GROUPS: dict[str, set[str]] = {
    "nonpolar": set("GALMIVPFW"),
    "polar": set("STYCNQ"),
    "acidic": set("DE"),
    "basic": set("RHK"),
    "aromatic": set("FWY"),
}


class FastaParser:
    """Parse single or multi-record FASTA text and produce analysis results."""

    # ── Public API ─────────────────────────────────────────────────────── #

    @staticmethod
    def parse(fasta_text: str) -> dict:
        """Parse FASTA text. Returns a dict for single record or a list of
        dicts when the input contains multiple '>' headers (Multi-FASTA)."""
        records = FastaParser._split_records(fasta_text)
        if not records:
            return FastaParser._empty_result()
        if len(records) == 1:
            return FastaParser._parse_single(*records[0])
        return {
            "multi_fasta": True,
            "record_count": len(records),
            "records": [FastaParser._parse_single(h, s) for h, s in records],
        }

    @staticmethod
    def parse_multi(fasta_text: str) -> list[dict]:
        """Always return a list of parsed records (even for a single record)."""
        records = FastaParser._split_records(fasta_text)
        if not records:
            return [FastaParser._empty_result()]
        return [FastaParser._parse_single(h, s) for h, s in records]

    @staticmethod
    def is_dna_sequence(sequence: str) -> bool:
        if not sequence:
            return False
        # Allow full IUPAC DNA/RNA alphabet + gap
        return set(sequence).issubset(set("ATGCNURYSWKMBDHV-"))

    @staticmethod
    def is_protein_sequence(sequence: str) -> bool:
        """Heuristic: if the sequence contains amino-acid-only characters
        (E, F, I, L, P, Q, etc.) it is almost certainly a protein."""
        if not sequence:
            return False
        upper = sequence.upper().replace("-", "")
        # Characters unique to protein (cannot appear in DNA/RNA)
        protein_unique = set("EFILPQXZJOB")
        sample = set(upper[:500])
        return bool(sample & protein_unique)

    # ── Backward-compatible single-record helpers ──────────────────────── #

    @staticmethod
    def analyze_dna(sequence: str) -> dict:
        counts = Counter(sequence)
        return FastaParser._analyze_dna_fast(sequence, counts, len(sequence))

    @staticmethod
    def reverse_complement(sequence: str) -> str:
        return sequence.translate(_IUPAC_COMPLEMENT)[::-1]

    @staticmethod
    def transcribe(sequence: str) -> str:
        return sequence.replace("T", "U")

    @staticmethod
    def build_visualization_data(sequence: str) -> dict:
        counts = Counter(sequence)
        return FastaParser._build_viz_fast(sequence, counts, len(sequence))

    @staticmethod
    def calculate_gc_skew(sequence: str, window_size: int = 1000) -> list[dict]:
        return FastaParser._gc_skew_adaptive(sequence, len(sequence))

    # ── Internal: record splitting ─────────────────────────────────────── #

    @staticmethod
    def _split_records(fasta_text: str) -> list[tuple[str, str]]:
        """Split FASTA text into (header, sequence) tuples."""
        lines = [line.strip() for line in fasta_text.splitlines() if line.strip()]
        if not lines:
            return []

        records: list[tuple[str, str]] = []
        current_header = ""
        current_seq_parts: list[str] = []

        for line in lines:
            if line.startswith(">"):
                # Save previous record if any
                if current_header or current_seq_parts:
                    records.append((current_header, "".join(current_seq_parts).upper().replace(" ", "")))
                current_header = line
                current_seq_parts = []
            else:
                current_seq_parts.append(line)

        # Save last record
        if current_header or current_seq_parts:
            records.append((current_header, "".join(current_seq_parts).upper().replace(" ", "")))

        return records

    @staticmethod
    def _empty_result() -> dict:
        return {
            "header": "",
            "sequence": "",
            "sequence_length": 0,
            "sequence_type": "unknown",
            "is_dna": False,
            "is_protein": False,
            "analysis": None,
            "visualization": None,
        }

    @staticmethod
    def _parse_single(header: str, sequence: str) -> dict:
        is_dna = FastaParser.is_dna_sequence(sequence)
        is_protein = not is_dna and FastaParser.is_protein_sequence(sequence)

        if is_dna:
            counts = Counter(sequence)
            length = len(sequence)
            return {
                "header": header,
                "sequence": sequence,
                "sequence_length": length,
                "sequence_type": "dna",
                "is_dna": True,
                "is_protein": False,
                "analysis": FastaParser._analyze_dna_fast(sequence, counts, length),
                "visualization": FastaParser._build_viz_fast(sequence, counts, length),
            }

        if is_protein:
            return {
                "header": header,
                "sequence": sequence,
                "sequence_length": len(sequence),
                "sequence_type": "protein",
                "is_dna": False,
                "is_protein": True,
                "analysis": FastaParser._analyze_protein(sequence),
                "visualization": FastaParser._build_protein_viz(sequence),
            }

        return {
            "header": header,
            "sequence": sequence,
            "sequence_length": len(sequence),
            "sequence_type": "unknown",
            "is_dna": False,
            "is_protein": False,
            "analysis": None,
            "visualization": None,
        }

    # ── DNA Analysis ───────────────────────────────────────────────────── #

    @staticmethod
    def _analyze_dna_fast(sequence: str, counts: Counter, length: int) -> dict:
        """Core analysis using a pre-computed Counter (avoids redundant passes)."""
        gc_count = counts.get("G", 0) + counts.get("C", 0)
        at_count = counts.get("A", 0) + counts.get("T", 0)

        is_large = length > _LARGE_SEQ_THRESHOLD

        return {
            "sequence_length": length,
            "gc_content_percent": round((gc_count / length) * 100, 2) if length else 0.0,
            "at_content_percent": round((at_count / length) * 100, 2) if length else 0.0,
            "base_counts": {base: counts.get(base, 0) for base in ["A", "T", "G", "C", "N", "U"]},
            "degenerate_base_counts": {
                base: counts.get(base, 0)
                for base in ["R", "Y", "S", "W", "K", "M", "B", "D", "H", "V"]
                if counts.get(base, 0) > 0
            },
            # Skip heavy string transforms for very large sequences
            "reverse_complement": (
                sequence.translate(_IUPAC_COMPLEMENT)[::-1]
                if not is_large
                else f"[Truncated — sequence is {length:,} bp]"
            ),
            "rna_sequence": (
                sequence.replace("T", "U")
                if not is_large
                else f"[Truncated — sequence is {length:,} bp]"
            ),
        }

    @staticmethod
    def _build_viz_fast(sequence: str, counts: Counter, length: int) -> dict:
        """Visualization data using a pre-computed Counter."""
        bases = ["A", "T", "G", "C", "N"]
        base_composition = [
            {
                "base": base,
                "count": counts.get(base, 0),
                "percentage": round((counts.get(base, 0) / length) * 100, 2) if length else 0.0,
            }
            for base in bases
        ]
        return {
            "base_composition": base_composition,
            "gc_skew_windows": FastaParser._gc_skew_adaptive(sequence, length),
        }

    @staticmethod
    def _gc_skew_adaptive(sequence: str, length: int) -> list[dict]:
        """GC skew with adaptive window size to keep result count manageable."""
        if length > 500_000:
            window_size = 10_000
        elif length > 100_000:
            window_size = 5_000
        elif length > 10_000:
            window_size = 2_000
        else:
            window_size = 1_000

        result = []
        for start in range(0, length, window_size):
            window = sequence[start : start + window_size]
            g_count = window.count("G")
            c_count = window.count("C")
            denominator = g_count + c_count
            result.append(
                {
                    "start": start,
                    "end": start + len(window),
                    "gc_skew": round((g_count - c_count) / denominator, 4) if denominator else 0.0,
                    "g_count": g_count,
                    "c_count": c_count,
                }
            )
        return result

    # ── Protein Analysis ───────────────────────────────────────────────── #

    @staticmethod
    def _analyze_protein(sequence: str) -> dict[str, Any]:
        """Compute biochemical properties of a protein sequence.

        Uses biopython's ProtParam when available, falls back to manual
        calculations when biopython is not installed.
        """
        clean = sequence.upper().replace("-", "").replace("*", "").replace("X", "")
        length = len(clean)
        if length == 0:
            return {
                "sequence_length": 0,
                "molecular_weight_da": 0.0,
                "theoretical_pi": 0.0,
                "gravy": 0.0,
                "extinction_coefficient_reduced": 0,
                "extinction_coefficient_oxidized": 0,
                "amino_acid_counts": {},
                "amino_acid_groups": {},
            }

        # Count amino acids
        counts = Counter(clean)

        # Amino acid group classification
        groups: dict[str, dict[str, Any]] = {}
        for group_name, members in _AA_GROUPS.items():
            group_count = sum(counts.get(aa, 0) for aa in members)
            groups[group_name] = {
                "count": group_count,
                "percentage": round((group_count / length) * 100, 2) if length else 0.0,
                "residues": sorted(members),
            }

        try:
            from Bio.SeqUtils.ProtParam import ProteinAnalysis
            analysis = ProteinAnalysis(clean)
            mw = round(analysis.molecular_weight(), 2)
            pi = round(analysis.isoelectric_point(), 2)
            gravy = round(analysis.gravy(), 4)
            ext_reduced, ext_oxidized = analysis.molar_extinction_coefficient()
        except Exception:
            # Manual fallback: approximate molecular weight from average residue mass
            avg_residue_mass = 128.16  # Average amino acid residue mass (Da)
            water_mass = 18.015
            mw = round(length * avg_residue_mass - (length - 1) * water_mass, 2)
            pi = 0.0  # Cannot reliably compute without pK tables
            gravy = 0.0
            ext_reduced = 0
            ext_oxidized = 0

        return {
            "sequence_length": length,
            "molecular_weight_da": mw,
            "theoretical_pi": pi,
            "gravy": gravy,
            "extinction_coefficient_reduced": ext_reduced,
            "extinction_coefficient_oxidized": ext_oxidized,
            "amino_acid_counts": {aa: counts.get(aa, 0) for aa in sorted(counts.keys())},
            "amino_acid_groups": groups,
        }

    @staticmethod
    def _build_protein_viz(sequence: str) -> dict[str, Any]:
        """Visualization data for protein sequences."""
        clean = sequence.upper().replace("-", "").replace("*", "")
        length = len(clean)
        counts = Counter(clean)

        # Top 20 most frequent amino acids
        aa_composition = [
            {
                "residue": aa,
                "count": count,
                "percentage": round((count / length) * 100, 2) if length else 0.0,
            }
            for aa, count in counts.most_common(20)
        ]

        # Property distribution
        property_dist = []
        for group_name, members in _AA_GROUPS.items():
            group_count = sum(counts.get(aa, 0) for aa in members)
            property_dist.append({
                "property": group_name,
                "count": group_count,
                "percentage": round((group_count / length) * 100, 2) if length else 0.0,
            })

        return {
            "amino_acid_composition": aa_composition,
            "property_distribution": property_dist,
        }
