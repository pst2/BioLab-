from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.data.mock_pubmed import MOCK_PUBMED
from app.repositories.paper_repository import PaperRepository
from app.services.base_search_service import BaseSearchService


class PubMedService(BaseSearchService):
    search_type = "pubmed_search"
    cache_version = "v2"
    success_message = "PubMed search completed successfully from NCBI and saved to local workspace"
    cache_message = "PubMed search loaded from local cache"
    local_message = "PubMed search loaded from local research database"
    mock_message = "NCBI unavailable, showing bundled local PubMed reference data"
    unavailable_message = "NCBI PubMed service is temporarily unavailable"
    cache_ttl_seconds = settings.CACHE_TTL_PUBMED_SECONDS
    mock_data = MOCK_PUBMED

    def __init__(self, db: Session):
        super().__init__(db)
        self.paper_repo = PaperRepository(db)

    async def search_pubmed(self, keyword: str, mode: str = "local_first"):
        return await self.search(
            keyword,
            self.ncbi_client.search_pubmed,
            mode=mode,
            local_search_fn=self.paper_repo.search,
            local_save_fn=self.paper_repo.upsert_many,
        )
