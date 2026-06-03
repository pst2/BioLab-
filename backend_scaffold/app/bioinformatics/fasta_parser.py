from collections import Counter


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

        return {
            "header": header,
            "sequence": sequence,
            "sequence_length": len(sequence),
            "is_dna": is_dna,
            "analysis": FastaParser.analyze_dna(sequence) if is_dna else None,
            "visualization": FastaParser.build_visualization_data(sequence) if is_dna else None,
        }

    @staticmethod
    def is_dna_sequence(sequence: str) -> bool:
        return bool(sequence) and all(base in {"A", "T", "G", "C", "N"} for base in sequence)

    @staticmethod
    def analyze_dna(sequence: str) -> dict:
        counts = Counter(sequence)
        length = len(sequence)
        gc_count = counts.get("G", 0) + counts.get("C", 0)
        at_count = counts.get("A", 0) + counts.get("T", 0)
        return {
            "sequence_length": length,
            "gc_content_percent": round((gc_count / length) * 100, 2) if length else 0.0,
            "at_content_percent": round((at_count / length) * 100, 2) if length else 0.0,
            "base_counts": {base: counts.get(base, 0) for base in ["A", "T", "G", "C", "N"]},
            "reverse_complement": FastaParser.reverse_complement(sequence),
            "rna_sequence": FastaParser.transcribe(sequence),
        }

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
        length = len(sequence)
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
            "gc_skew_windows": FastaParser.calculate_gc_skew(sequence),
        }

    @staticmethod
    def calculate_gc_skew(sequence: str, window_size: int = 1000) -> list[dict]:
        result = []
        for start in range(0, len(sequence), window_size):
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
