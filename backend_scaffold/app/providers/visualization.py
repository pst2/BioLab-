from __future__ import annotations

from typing import Any


def clean_sequence(sequence: str | None) -> str:
    if not sequence:
        return ""
    return "".join(ch for ch in str(sequence).upper() if ch.isalpha())


def sequence_stats(sequence: str | None) -> dict[str, Any]:
    seq = clean_sequence(sequence)
    counts = {base: seq.count(base) for base in ["A", "T", "G", "C", "U", "N"]}
    length = len(seq)
    gc = counts["G"] + counts["C"]
    at = counts["A"] + counts["T"]
    return {
        "sequence_length": length,
        "base_counts": counts,
        "gc_content": round((gc / length) * 100, 2) if length else 0,
        "at_content": round((at / length) * 100, 2) if length else 0,
    }


def wrap_fasta(header: str, sequence: str | None, line_width: int = 70) -> str:
    seq = clean_sequence(sequence)
    if not seq:
        return ""
    lines = [f">{header}"]
    lines.extend(seq[index : index + line_width] for index in range(0, len(seq), line_width))
    return "\n".join(lines)


def build_gene_visualization(record: dict[str, Any]) -> dict[str, Any]:
    sequence = clean_sequence(record.get("sequence"))
    stats = sequence_stats(sequence)
    start = _safe_int(record.get("start"))
    end = _safe_int(record.get("end"))
    chromosome = record.get("chromosome") or record.get("seq_region_name") or "Unknown"
    transcripts = record.get("transcripts") if isinstance(record.get("transcripts"), list) else []
    protein = record.get("protein") if isinstance(record.get("protein"), dict) else None

    return {
        "location": {
            "chromosome": chromosome,
            "start": start,
            "end": end,
            "strand": record.get("strand"),
            "assembly": record.get("assembly") or record.get("assembly_name") or "Unknown",
        },
        "sequence_composition": stats,
        "transcripts": transcripts,
        "protein": protein,
    }


def enrich_with_sequence_fields(record: dict[str, Any], *, sequence_type: str = "genomic") -> dict[str, Any]:
    sequence = clean_sequence(record.get("sequence"))
    if sequence:
        stats = sequence_stats(sequence)
        record.setdefault("sequence_type", sequence_type)
        record["sequence"] = sequence
        record["sequence_length"] = stats["sequence_length"]
        record["base_counts"] = stats["base_counts"]
        record["gc_content"] = stats["gc_content"]
        record["at_content"] = stats["at_content"]
        header = f"{record.get('gene_id') or record.get('id') or 'sequence'} {record.get('symbol') or ''} {record.get('organism') or ''}".strip()
        record["fasta"] = record.get("fasta") or wrap_fasta(header, sequence)
    record["visualization"] = build_gene_visualization(record)
    return record


def _safe_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None
