from sqlalchemy.orm import Session

from app.db.models import SearchHistory


class HistoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        query_type: str,
        keyword: str,
        mode: str = "local_first",
        result_source: str = "unknown",
        result_count: int = 0,
    ) -> SearchHistory:
        item = SearchHistory(
            query_type=query_type,
            keyword=keyword,
            mode=mode,
            result_source=result_source,
            result_count=result_count,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
