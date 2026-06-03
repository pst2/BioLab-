from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.sequence import SequenceAnalyzeRequest, SequenceFetchRequest
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
