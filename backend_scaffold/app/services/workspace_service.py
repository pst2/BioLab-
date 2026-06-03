from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import CacheEntry, GeneRecord, ResearchPaper, SearchHistory, SequenceRecord
from app.schemas.common import ApiResponse, MetaInfo


class WorkspaceService:
    def __init__(self, db: Session):
        self.db = db

    def overview(self) -> ApiResponse:
        local_genes = self.db.query(GeneRecord).count()
        local_papers = self.db.query(ResearchPaper).count()
        local_sequences = self.db.query(SequenceRecord).count()
        cache_entries = self.db.query(CacheEntry).count()
        recent_searches = self.db.query(SearchHistory).order_by(SearchHistory.created_at.desc()).limit(10).all()

        total_assets = local_genes + local_papers + local_sequences + cache_entries
        external_assets = (
            self.db.query(GeneRecord).filter(GeneRecord.source == "ncbi").count()
            + self.db.query(ResearchPaper).filter(ResearchPaper.source == "ncbi").count()
        )
        ncbi_percent = round((external_assets / total_assets) * 100, 2) if total_assets else 0.0
        internal_percent = round(100 - ncbi_percent, 2) if total_assets else 100.0

        return ApiResponse(
            success=True,
            message="Bioinformatics workspace overview loaded successfully",
            data={
                "counts": {
                    "local_genes": local_genes,
                    "saved_papers": local_papers,
                    "analyzed_sequences": local_sequences,
                    "cache_entries": cache_entries,
                },
                "dependency_ratio": {
                    "internal_percent": internal_percent,
                    "ncbi_percent": ncbi_percent,
                    "target": "Keep NCBI around 30-40%; keep local database, cache and internal analysis around 60-70%.",
                },
                "recent_searches": [
                    {
                        "type": item.query_type,
                        "keyword": item.keyword,
                        "mode": item.mode,
                        "source": item.result_source,
                        "count": item.result_count,
                        "created_at": item.created_at.isoformat() if item.created_at else None,
                    }
                    for item in recent_searches
                ],
            },
            meta=MetaInfo(source="internal", cached=False, stale=False),
        )
