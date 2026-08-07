from collections import Counter

# Threshold above which we skip expensive string-transform outputs
# (reverse_complement, transcribe) to keep response times fast.
_LARGE_SEQ_THRESHOLD = 50_000


class FastaParser:
    @staticmethod
    def parse(fasta_text: str) -> dict:
        lines = [line.strip() for line in fasta_text.splitlines() if line.strip()]
        if not lines:
            return {
                "header": "",
                "sequence": "",
                "sequence_length": 0,
                "is_dna": False,
                "analysis": None,
                "visualization": None,
            }

        header = lines[0] if lines[0].startswith(">") else ""
        sequence_lines = lines[1:] if header else lines
        sequence = "".join(sequence_lines).upper().replace(" ", "")
        is_dna = FastaParser.is_dna_sequence(sequence)

        if not is_dna:
            return {
                "header": header,
                "sequence": sequence,
                "sequence_length": len(sequence),
                "is_dna": False,
                "analysis": None,
                "visualization": None,
            }

        # Single Counter pass — shared between analyze and visualization
        counts = Counter(sequence)
        length = len(sequence)

        return {
            "header": header,
            "sequence": sequence,
            "sequence_length": length,
            "is_dna": True,
            "analysis": FastaParser._analyze_dna_fast(sequence, counts, length),
            "visualization": FastaParser._build_viz_fast(sequence, counts, length),
        }

    @staticmethod
    def is_dna_sequence(sequence: str) -> bool:
        if not sequence:
            return False
        # Set-based check is O(unique_chars) instead of O(n)
        return set(sequence).issubset({"A", "T", "G", "C", "N"})

    # ── Public API (kept for backward compat) ──────────────────────────── #

    @staticmethod
    def analyze_dna(sequence: str) -> dict:
        counts = Counter(sequence)
        return FastaParser._analyze_dna_fast(sequence, counts, len(sequence))

    @staticmethod
    def reverse_complement(sequence: str) -> str:
        complement_map = str.maketrans({"A": "T", "T": "A", "G": "C", "C": "G", "N": "N"})
        return sequence.translate(complement_map)[::-1]

    @staticmethod
    def transcribe(sequence: str) -> str:
        return sequence.replace("T", "U")

    @staticmethod
    def build_visualization_data(sequence: str) -> dict:
        counts = Counter(sequence)
        return FastaParser._build_viz_fast(sequence, counts, len(sequence))

    # ── Optimised internals ────────────────────────────────────────────── #

    @staticmethod
    def _analyze_dna_fast(sequence: str, counts: Counter, length: int) -> dict:
        """Core analysis using a pre-computed Counter (avoids redundant passes)."""
        gc_count = counts.get("G", 0) + counts.get("C", 0)
        at_count = counts.get("A", 0) + counts.get("T", 0)

        is_large = length > _LARGE_SEQ_THRESHOLD
        complement_map = str.maketrans({"A": "T", "T": "A", "G": "C", "C": "G", "N": "N"})

        return {
            "sequence_length": length,
            "gc_content_percent": round((gc_count / length) * 100, 2) if length else 0.0,
            "at_content_percent": round((at_count / length) * 100, 2) if length else 0.0,
            "base_counts": {base: counts.get(base, 0) for base in ["A", "T", "G", "C", "N"]},
            # Skip heavy string transforms for very large sequences
            "reverse_complement": (
                sequence.translate(complement_map)[::-1] if not is_large else f"[Truncated — sequence is {length:,} bp]"
            ),
            "rna_sequence": (
                sequence.replace("T", "U") if not is_large else f"[Truncated — sequence is {length:,} bp]"
            ),
        }

    @staticmethod
    def _build_viz_fast(sequence: str, counts: Counter, length: int) -> dict:
        """Visualization data using a pre-computed Counter."""
        base_composition = [
            {
                "base": base,
                "count": counts.get(base, 0),
                "percentage": round((counts.get(base, 0) / length) * 100, 2) if length else 0.0,
            }
            for base in ["A", "T", "G", "C", "N"]
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

    # Legacy static kept for existing callers
    @staticmethod
    def calculate_gc_skew(sequence: str, window_size: int = 1000) -> list[dict]:
        return FastaParser._gc_skew_adaptive(sequence, len(sequence))
