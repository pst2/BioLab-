from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.clients.ncbi_client import NCBIClient
from app.schemas.common import ApiResponse, MetaInfo


class SystemService:
    def __init__(self, db: Session):
        self.db = db
        self.ncbi_client = NCBIClient()

    async def health_check(self) -> ApiResponse:
        checks = await self._run_checks()
        status = "healthy" if all(checks.values()) else "degraded"

        return ApiResponse(
            success=True,
            message="Health check completed",
            data={
                "status": status,
                "database": checks["database"],
                "ncbi": checks["ncbi"],
            },
            meta=MetaInfo(source="internal"),
        )

    async def system_status(self) -> ApiResponse:
        checks = await self._run_checks()
        status = "healthy" if all(checks.values()) else "degraded"

        return ApiResponse(
            success=True,
            message="System status fetched successfully",
            data={
                "status": status,
                "services": {
                    "api": "up",
                    "database": "up" if checks["database"] else "down",
                    "cache": "up" if checks["database"] else "down",
                    "ncbi": "up" if checks["ncbi"] else "down",
                },
            },
            meta=MetaInfo(source="internal"),
        )

    async def _run_checks(self) -> dict[str, bool]:
        return {
            "database": self._check_database(),
            "ncbi": await self._check_ncbi(),
        }

    def _check_database(self) -> bool:
        try:
            self.db.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    async def _check_ncbi(self) -> bool:
        try:
            return await self.ncbi_client.ping()
        except Exception:
            return False
