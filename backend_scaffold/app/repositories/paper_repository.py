from __future__ import annotations

import re
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import ResearchPaper


class PaperRepository:
    def __init__(self, db: Session):
        self.db = db

    def search(self, keyword: str, limit: int = 20) -> list[dict[str, Any]]:
        term = f"%{keyword.strip()}%"
        rows = (
            self.db.query(ResearchPaper)
            .filter(
                or_(
                    ResearchPaper.title.ilike(term),
                    ResearchPaper.abstract.ilike(term),
                    ResearchPaper.journal.ilike(term),
                    ResearchPaper.doi.ilike(term),
                    ResearchPaper.pubmed_id.ilike(term),
                )
            )
            .order_by(ResearchPaper.updated_at.desc())
            .limit(limit)
            .all()
        )
        return [self.to_dict(row) for row in rows]

    def upsert_many(self, items: list[dict[str, Any]], source: str = "ncbi") -> None:
        for item in items:
            self.upsert(item, source=source)
        self.db.commit()

    def upsert(self, item: dict[str, Any], source: str = "ncbi") -> ResearchPaper:
        pubmed_id = str(item.get("pmid") or item.get("pubmed_id") or "").strip() or None
        row = None
        if pubmed_id:
            row = self.db.query(ResearchPaper).filter(ResearchPaper.pubmed_id == pubmed_id).first()
        if row is None:
            title = (item.get("title") or "Untitled paper").strip()
            row = self.db.query(ResearchPaper).filter(ResearchPaper.title == title).first()
        if row is None:
            row = ResearchPaper(title=item.get("title") or "Untitled paper")
            self.db.add(row)

        row.title = item.get("title") or row.title
        row.abstract = item.get("abstract") or ""
        row.journal = item.get("journal") or item.get("source") or ""
        row.year = item.get("year") or self._extract_year(item.get("pubdate") or "")
        row.authors = item.get("authors") or []
        row.doi = item.get("doi") or None
        row.pubmed_id = pubmed_id
        row.source = source
        row.payload = item
        return row

    def to_dict(self, row: ResearchPaper) -> dict[str, Any]:
        payload = row.payload or {}
        data = {
            "id": row.id,
            "pmid": row.pubmed_id,
            "pubmed_id": row.pubmed_id,
            "title": row.title,
            "abstract": row.abstract,
            "source": row.journal or row.source,
            "journal": row.journal,
            "year": row.year,
            "authors": row.authors or [],
            "doi": row.doi,
            "data_source": row.source,
        }
        data.update({key: value for key, value in payload.items() if key not in data or not data[key]})
        data["local_id"] = row.id
        data["data_source"] = row.source
        return data

    def _extract_year(self, pubdate: str) -> int | None:
        match = re.search(r"\b(19|20)\d{2}\b", pubdate or "")
        return int(match.group(0)) if match else None
