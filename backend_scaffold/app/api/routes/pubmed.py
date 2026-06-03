from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.services.pubmed_service import PubMedService

router = APIRouter()


@router.get("/search")
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def search_pubmed(
    request: Request,
    q: str = Query(..., min_length=2, description="PubMed keyword, e.g. cancer"),
    mode: str = Query(
        default="local_first",
        pattern="^(local_first|local_only|external_refresh)$",
        description="local_first uses local cache/database before NCBI; local_only never calls NCBI; external_refresh refreshes from NCBI and saves locally.",
    ),
    db: Session = Depends(get_db),
):
    service = PubMedService(db)
    return await service.search_pubmed(q, mode=mode)
