from typing import Literal

from pydantic import BaseModel, Field


class SequenceAnalyzeRequest(BaseModel):
    sequence: str = Field(..., min_length=1, description="DNA sequence, e.g. ATGCGT")
    name: str | None = Field(default=None, description="Optional local workspace name")
    motifs: list[str] = Field(default_factory=list, description="Optional DNA motifs to search, e.g. ATG,TATA")
    save: bool = Field(default=True, description="Save analysis to the local workspace database when DB is available")


class SequenceFetchRequest(BaseModel):
    accession: str = Field(..., min_length=1, description="NCBI accession ID, e.g. NC_045512.2")
    db: str = Field(default="nuccore", description="NCBI database, e.g. nuccore, protein")


# ── BLAST Similarity Search ────────────────────────────────────────────────────

class SequenceSearchRequest(BaseModel):
    sequence: str = Field(..., min_length=5, description="FASTA or raw DNA/protein sequence")
    sequence_type: Literal["auto", "dna", "protein"] = Field(
        default="auto",
        description="Sequence type; 'auto' detects automatically",
    )
    provider: Literal["auto", "ebi", "uniprot"] = Field(
        default="auto",
        description="BLAST provider: 'auto' tries EBI first then UniProt; 'ebi' = EBI NCBI BLAST; 'uniprot' = UniProt BLAST",
    )
    database: str | None = Field(
        default=None,
        description="Override target database (EBI: uniprotkb_swissprot, uniprotkb, pdb, emrel; UniProt: UniProtKB)",
    )
    evalue_cutoff: float | None = Field(
        default=10.0,
        description="Expectation value (E-value) threshold",
    )
    matrix: str | None = Field(
        default="BLOSUM62",
        description="Scoring matrix for protein alignments (BLOSUM62, BLOSUM45, PAM30, PAM70)",
    )
    gap_open: int | None = Field(
        default=None,
        description="Cost to open a gap (optional)",
    )
    gap_extend: int | None = Field(
        default=None,
        description="Cost to extend a gap (optional)",
    )


class BlastHit(BaseModel):
    accession: str
    description: str
    e_value: float
    identity_percent: float
    query_coverage_percent: float
    alignment_length: int
    source: str  # 'ebi' | 'uniprot'
    bit_score: float | None = None
    gaps: int | None = None
    query_seq: str | None = None
    match_seq: str | None = None
    subject_seq: str | None = None
    query_from: int | None = None
    query_to: int | None = None
    hit_from: int | None = None
    hit_to: int | None = None


class SequenceSearchJob(BaseModel):
    job_id: str
    status: str  # PENDING | RUNNING | FINISHED | ERROR | NOT_FOUND
    provider: str
    sequence_type: str = ""
    database: str = ""
    hits: list[BlastHit] | None = None
    error: str | None = None

