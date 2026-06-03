from pydantic import BaseModel, Field


class SequenceAnalyzeRequest(BaseModel):
    sequence: str = Field(..., min_length=1, description="DNA sequence, e.g. ATGCGT")
    name: str | None = Field(default=None, description="Optional local workspace name")
    motifs: list[str] = Field(default_factory=list, description="Optional DNA motifs to search, e.g. ATG,TATA")
    save: bool = Field(default=True, description="Save analysis to the local workspace database when DB is available")


class SequenceFetchRequest(BaseModel):
    accession: str = Field(..., min_length=1, description="NCBI accession ID, e.g. NC_045512.2")
    db: str = Field(default="nuccore", description="NCBI database, e.g. nuccore, protein")
