from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CacheEntry(Base):
    __tablename__ = "cache_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    payload: Mapped[dict | list] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    query_type: Mapped[str] = mapped_column(String(100), index=True)
    keyword: Mapped[str] = mapped_column(String(255), index=True)
    mode: Mapped[str] = mapped_column(String(50), default="local_first", index=True)
    result_source: Mapped[str] = mapped_column(String(100), default="unknown", index=True)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SystemLog(Base):
    __tablename__ = "system_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    level: Mapped[str] = mapped_column(String(20), index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class GeneRecord(Base):
    __tablename__ = "genes"
    __table_args__ = (UniqueConstraint("symbol", "organism", name="uq_gene_symbol_organism"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    organism: Mapped[str] = mapped_column(String(255), default="Unknown", index=True)
    ncbi_gene_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="local", index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ResearchPaper(Base):
    __tablename__ = "research_papers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    abstract: Mapped[str] = mapped_column(Text, default="")
    journal: Mapped[str] = mapped_column(String(500), default="")
    year: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    authors: Mapped[list] = mapped_column(JSON, default=list)
    doi: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    pubmed_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="local", index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class SequenceRecord(Base):
    __tablename__ = "sequences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="Untitled sequence", index=True)
    sequence: Mapped[str] = mapped_column(Text, nullable=False)
    sequence_length: Mapped[int] = mapped_column(Integer, index=True)
    gc_content_percent: Mapped[float] = mapped_column(Float, index=True)
    at_content_percent: Mapped[float] = mapped_column(Float, index=True)
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(50), default="user_input", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
