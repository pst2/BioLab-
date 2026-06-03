from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.services.gene_service import GeneService

router = APIRouter()


@router.get("/search")
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def search_genes(
    request: Request,
    q: str = Query(..., min_length=1, description="Keyword or ID, e.g. BRCA1, 672, NM_007294, NP_009225"),
    data_type: str = Query(
        default="gene",
        pattern="^(gene|nucleotide|nuccore|protein)$",
        description="Biological data type to search: gene, nucleotide/nuccore, or protein.",
    ),
    search_by: str = Query(
        default="name",
        pattern="^(name|id)$",
        description="Search by name/symbol/keyword or by exact NCBI/accession ID.",
    ),
    organism: str | None = Query(
        default=None,
        description="Optional organism/taxonomy filter, e.g. Homo sapiens, Mus musculus.",
    ),
    mode: str = Query(
        default="local_first",
        pattern="^(local_first|local_only|external_refresh)$",
        description="local_first uses local cache/database before NCBI; local_only never calls NCBI; external_refresh refreshes from NCBI and saves locally.",
    ),
    db: Session = Depends(get_db),
):
    service = GeneService(db)
    return await service.search_genes(
        q,
        mode=mode,
        data_type=data_type,
        search_by=search_by,
        organism=organism,
    )


@router.get("/{gene_id}")
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def get_gene_detail(
    request: Request,
    gene_id: str,
    db: Session = Depends(get_db),
):
    service = GeneService(db)
    return await service.get_gene_detail(gene_id)
