from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import RequireApiKey
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.services.system_service import SystemService
from app.services.workspace_service import WorkspaceService

router = APIRouter()


@router.get("/health", response_model=ApiResponse)
@limiter.limit(settings.RATE_LIMIT_SYSTEM)
async def health(request: Request, db: Session = Depends(get_db)) -> ApiResponse:
    service = SystemService(db)
    return await service.health_check()


@router.get("/system/status", response_model=ApiResponse, dependencies=[RequireApiKey])
@limiter.limit(settings.RATE_LIMIT_SYSTEM)
async def system_status(request: Request, db: Session = Depends(get_db)) -> ApiResponse:
    service = SystemService(db)
    return await service.system_status()



@router.get("/workspace/overview", response_model=ApiResponse)
@limiter.limit(settings.RATE_LIMIT_SYSTEM)
async def workspace_overview(
    request: Request,
    db: Session = Depends(get_db),
) -> ApiResponse:
    service = WorkspaceService(db)
    return service.overview()
