from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.sequence import SequenceAnalyzeRequest, SequenceFetchRequest, SequenceSearchRequest
from app.services.sequence_service import SequenceService

router = APIRouter()


@router.post("/analyze", response_model=ApiResponse)
def analyze_sequence(
    payload: SequenceAnalyzeRequest,
    db: Session = Depends(get_db),
) -> ApiResponse:
    service = SequenceService(db=db)
    return service.analyze(payload)


@router.get("/local", response_model=ApiResponse)
def list_local_sequences(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ApiResponse:
    service = SequenceService(db=db)
    return service.list_local_sequences(limit=limit)


@router.post("/fetch/fasta", response_model=ApiResponse)
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def fetch_fasta_sequence(
    request: Request,
    payload: SequenceFetchRequest,
    db: Session = Depends(get_db),
) -> ApiResponse:
    service = SequenceService(db=db)
    return await service.fetch_fasta(payload)


@router.post("/fetch/genbank", response_model=ApiResponse)
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def fetch_genbank_sequence(
    request: Request,
    payload: SequenceFetchRequest,
    db: Session = Depends(get_db),
) -> ApiResponse:
    service = SequenceService(db=db)
    return await service.fetch_genbank(payload)


# ── BLAST Similarity Search ────────────────────────────────────────────────────

@router.post("/search/submit", response_model=ApiResponse)
@limiter.limit("5/minute")
async def submit_sequence_search(
    request: Request,
    payload: SequenceSearchRequest,
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Submit a BLAST similarity search job.

    Supports multi-provider (EBI NCBI BLAST + UniProt BLAST) with auto-fallback.
    Returns a job_id for polling via /search/status/{job_id}.
    """
    service = SequenceService(db=db)
    return await service.submit_similarity_search(payload)


@router.get("/search/status/{job_id}", response_model=ApiResponse)
@limiter.limit("60/minute")
async def check_sequence_search_status(
    request: Request,
    job_id: str,
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Poll the status of a submitted BLAST job.

    Returns status RUNNING/PENDING while the job is in progress,
    and FINISHED with hits[] when complete.
    """
    service = SequenceService(db=db)
    return await service.check_similarity_search_status(job_id)


# ── IGV.js Raw FASTA Endpoint ──────────────────────────────────────────────────

@router.get("/igv/fasta")
@limiter.limit("30/minute")
async def igv_fasta(
    request: Request,
    accession: str = Query(..., min_length=1, description="RefSeq accession, e.g. NC_000005.10"),
    start: int | None = Query(default=None, ge=1, description="1-based start coordinate (inclusive)"),
    end: int | None = Query(default=None, ge=1, description="1-based end coordinate (inclusive)"),
    db: Session = Depends(get_db),
) -> Response:
    """Raw FASTA endpoint for IGV.js.

    Returns bare text/plain — NOT wrapped in ApiResponse.
    IGV.js requires raw FASTA with Content-Type: text/plain.

    Supports optional region slicing (start/end). If omitted the full record
    is returned — avoid omitting them for chromosome-scale accessions (NC_*).
    """
    service = SequenceService(db=db)
    try:
        fasta_text = await service.fetch_raw_fasta_for_igv(
            accession=accession,
            start=start,
            end=end,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"NCBI fetch failed: {exc}") from exc

    if not fasta_text or not fasta_text.strip().startswith(">"):
        raise HTTPException(
            status_code=404,
            detail=f"No FASTA sequence found for accession '{accession}'",
        )

    return Response(
        content=fasta_text,
        media_type="text/plain",
        headers={
            # Allow IGV.js running on the Next.js dev origin to load this directly
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
        },
    )
