from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db.models import SequenceRecord


class SequenceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, sequence: str, analysis: dict[str, Any], name: str = "Untitled sequence", source: str = "user_input") -> dict[str, Any]:
        row = SequenceRecord(
            name=name,
            sequence=sequence,
            sequence_length=analysis.get("sequence_length", len(sequence)),
            gc_content_percent=analysis.get("gc_content_percent", 0.0),
            at_content_percent=analysis.get("at_content_percent", 0.0),
            analysis=analysis,
            source=source,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self.to_dict(row)

    def recent(self, limit: int = 20) -> list[dict[str, Any]]:
        rows = self.db.query(SequenceRecord).order_by(SequenceRecord.created_at.desc()).limit(limit).all()
        return [self.to_dict(row) for row in rows]

    def to_dict(self, row: SequenceRecord) -> dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "sequence_length": row.sequence_length,
            "gc_content_percent": row.gc_content_percent,
            "at_content_percent": row.at_content_percent,
            "analysis": row.analysis,
            "source": row.source,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
