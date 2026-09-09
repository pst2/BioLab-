"""
export.py — Data export endpoints for research-grade file downloads.

Supports:
  - FASTA sequence export
  - GenBank format export
  - BED file export (exon coordinates)
  - CSV/TSV search results export
  - BibTeX / RIS citation export for PubMed articles
"""
from __future__ import annotations

import csv
import io
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.gene_repository import GeneRepository

router = APIRouter()


# ── Sequence Exports ──────────────────────────────────────────────────────────

@router.get("/gene/{gene_id}/fasta")
def export_gene_fasta(gene_id: str, db: Session = Depends(get_db)) -> Response:
    """Download gene data as a .fasta file."""
    repo = GeneRepository(db)
    record = repo.get_by_gene_id(gene_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Gene {gene_id} not found in local database")

    sequence = record.get("sequence") or record.get("fasta") or ""
    symbol = record.get("symbol", gene_id)
    organism = record.get("organism", "Unknown")
    description = record.get("name") or record.get("description") or ""

    if not sequence:
        raise HTTPException(status_code=404, detail=f"No sequence data available for gene {gene_id}")

    # Build FASTA header
    header = f">{symbol} | {description} [{organism}]"
    # Wrap sequence at 70 characters per line (FASTA convention)
    wrapped = "\n".join(sequence[i:i + 70] for i in range(0, len(sequence), 70))
    fasta_content = f"{header}\n{wrapped}\n"

    filename = f"{symbol}_{gene_id}.fasta"
    return Response(
        content=fasta_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/gene/{gene_id}/json")
def export_gene_json(gene_id: str, db: Session = Depends(get_db)) -> Response:
    """Download gene data as a .json file."""
    import json
    repo = GeneRepository(db)
    record = repo.get_by_gene_id(gene_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Gene {gene_id} not found in local database")

    symbol = record.get("symbol", gene_id)
    json_content = json.dumps(record, indent=2, ensure_ascii=False, default=str)
    filename = f"{symbol}_{gene_id}.json"
    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/gene/{gene_id}/genbank")
def export_gene_genbank(gene_id: str, db: Session = Depends(get_db)) -> Response:
    """Download gene data as a standard GenBank (.gb) format flatfile."""
    import datetime
    repo = GeneRepository(db)
    record = repo.get_by_gene_id(gene_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Gene {gene_id} not found in local database")

    sequence = (record.get("sequence") or record.get("fasta") or "").strip()
    symbol = record.get("symbol", gene_id)
    organism = record.get("organism", "Unknown")
    description = record.get("name") or record.get("description") or f"{symbol} gene"
    chromosome = record.get("chromosome", "Unknown")
    genomic_acc = record.get("genomic_accession") or gene_id
    seq_len = len(sequence)

    date_str = datetime.date.today().strftime("%d-%b-%Y").upper()
    locus_line = f"LOCUS       {symbol[:16]:<16} {seq_len:>7} bp    DNA     linear   {date_str}"

    origin_lines = []
    if sequence:
        clean_seq = sequence.lower()
        for i in range(0, len(clean_seq), 60):
            chunk = clean_seq[i:i + 60]
            blocks = " ".join(chunk[j:j + 10] for j in range(0, len(chunk), 10))
            origin_lines.append(f"{i + 1:>9} {blocks}")
    origin_block = "\n".join(origin_lines) if origin_lines else "        1 "

    gb_content = f"""{locus_line}
DEFINITION  {description}.
ACCESSION   {genomic_acc}
VERSION     {genomic_acc}
KEYWORDS    .
SOURCE      {organism}
  ORGANISM  {organism}
FEATURES             Location/Qualifiers
     source          1..{max(seq_len, 1)}
                     /organism="{organism}"
                     /chromosome="{chromosome}"
     gene            1..{max(seq_len, 1)}
                     /gene="{symbol}"
                     /db_xref="GeneID:{gene_id}"
ORIGIN
{origin_block}
//
"""
    filename = f"{symbol}_{gene_id}.gb"
    return Response(
        content=gb_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/gene/{gene_id}/bed")
def export_gene_bed(gene_id: str, db: Session = Depends(get_db)) -> Response:
    """Download gene locus and exon coordinates in standard BED format."""
    repo = GeneRepository(db)
    record = repo.get_by_gene_id(gene_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Gene {gene_id} not found in local database")

    symbol = record.get("symbol", gene_id)
    chrom = str(record.get("chromosome", "1"))
    if not chrom.startswith("chr") and (chrom.isalnum() or chrom in ("X", "Y", "MT")):
        chrom = f"chr{chrom}"
    start = int(record.get("start") or 0)
    end = int(record.get("end") or start + 1000)
    strand = record.get("strand", "+")
    if strand not in ("+", "-"):
        strand = "+"

    bed_start = max(0, start - 1)
    bed_end = max(bed_start + 1, end)

    lines = [
        f"# BED format export: {symbol} (GeneID: {gene_id})",
        f"track name=\"{symbol}\" description=\"{record.get('name', symbol)}\" visibility=pack",
    ]

    transcripts = record.get("transcripts") or []
    if transcripts and isinstance(transcripts, list):
        for tx in transcripts:
            tx_id = tx.get("transcript_id") or tx.get("id") or symbol
            tx_start = max(0, int(tx.get("start") or start) - 1)
            tx_end = max(tx_start + 1, int(tx.get("end") or end))
            lines.append(f"{chrom}\t{tx_start}\t{tx_end}\t{tx_id}\t1000\t{strand}")
    else:
        lines.append(f"{chrom}\t{bed_start}\t{bed_end}\t{symbol}\t1000\t{strand}")

    bed_content = "\n".join(lines) + "\n"
    filename = f"{symbol}_{gene_id}.bed"
    return Response(
        content=bed_content,
        media_type="text/tab-separated-values",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/search/csv")
def export_search_csv(
    q: str = Query(..., min_length=1, description="Search query"),
    db: Session = Depends(get_db),
) -> Response:
    """Export gene search results from local repository as CSV."""
    repo = GeneRepository(db)
    records = repo.search(q, limit=100)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["gene_id", "symbol", "name", "organism", "chromosome", "start", "end", "source"])

    for rec in records:
        writer.writerow([
            rec.get("gene_id", ""),
            rec.get("symbol", ""),
            rec.get("name", rec.get("description", "")),
            rec.get("organism", ""),
            rec.get("chromosome", ""),
            rec.get("start", ""),
            rec.get("end", ""),
            rec.get("source", ""),
        ])

    filename = f"search_results_{q}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


# ── Citation Exports ──────────────────────────────────────────────────────────

@router.get("/citation/bibtex")
def export_bibtex(
    pmid: str = Query(..., description="PubMed ID"),
    title: str = Query(default="", description="Article title"),
    authors: str = Query(default="", description="Comma-separated author list"),
    journal: str = Query(default="", description="Journal name"),
    year: str = Query(default="", description="Publication year"),
    doi: str = Query(default="", description="DOI"),
) -> Response:
    """Generate a BibTeX citation entry for a PubMed article."""
    # Extract year from pubdate if needed
    year_match = re.search(r"\b(19|20)\d{2}\b", year)
    cite_year = year_match.group(0) if year_match else "n.d."

    # Build citation key
    author_tokens = authors.split(",")[0].strip().split() if authors else []
    if not author_tokens:
        first_author = "Unknown"
    elif len(author_tokens) > 1 and len(author_tokens[-1]) <= 2:
        first_author = author_tokens[0]
    else:
        first_author = author_tokens[-1]
    cite_key = f"{first_author}{cite_year}_{pmid}"

    bibtex = f"""@article{{{cite_key},
  title     = {{{title}}},
  author    = {{{authors}}},
  journal   = {{{journal}}},
  year      = {{{cite_year}}},
  pmid      = {{{pmid}}},
  doi       = {{{doi}}},
  url       = {{https://pubmed.ncbi.nlm.nih.gov/{pmid}/}},
}}
"""
    return Response(
        content=bibtex,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="pubmed_{pmid}.bib"',
        },
    )


@router.get("/citation/ris")
def export_ris(
    pmid: str = Query(..., description="PubMed ID"),
    title: str = Query(default="", description="Article title"),
    authors: str = Query(default="", description="Comma-separated author list"),
    journal: str = Query(default="", description="Journal name"),
    year: str = Query(default="", description="Publication year"),
    doi: str = Query(default="", description="DOI"),
    abstract: str = Query(default="", description="Article abstract"),
) -> Response:
    """Generate an RIS citation entry (compatible with Zotero, Mendeley, EndNote)."""
    year_match = re.search(r"\b(19|20)\d{2}\b", year)
    cite_year = year_match.group(0) if year_match else ""

    lines = [
        "TY  - JOUR",
        f"TI  - {title}",
    ]
    for author in authors.split(","):
        author = author.strip()
        if author:
            lines.append(f"AU  - {author}")
    lines.extend([
        f"JO  - {journal}",
        f"PY  - {cite_year}",
        f"AN  - PMID:{pmid}",
        f"DO  - {doi}",
        f"UR  - https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
    ])
    if abstract:
        lines.append(f"AB  - {abstract}")
    lines.append("ER  -")
    lines.append("")

    ris_content = "\n".join(lines)
    return Response(
        content=ris_content,
        media_type="application/x-research-info-systems",
        headers={
            "Content-Disposition": f'attachment; filename="pubmed_{pmid}.ris"',
        },
    )
