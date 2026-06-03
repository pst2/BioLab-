"""enforce alembic-only schema management

Remove any dependency on init_db() / create_all(). This migration is a
no-op for databases that already have the full schema from 0002; it exists
so that the alembic version table records the intent explicitly.

Revision ID: 0003_enforce_alembic_only
Revises: 0002_local_first_workspace
Create Date: 2026-05-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003_enforce_alembic_only"
down_revision = "0002_local_first_workspace"
branch_labels = None
depends_on = None


def _index_exists(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return index_name in {idx["name"] for idx in inspector.get_indexes(table_name)}


def upgrade() -> None:
    # Ensure the id primary-key indexes exist on every table — they may be
    # missing on older SQLite databases that were created via create_all()
    # before Alembic was adopted.
    for table, index in [
        ("cache_entries", "ix_cache_entries_id"),
        ("search_history", "ix_search_history_id"),
        ("system_logs", "ix_system_logs_id"),
        ("genes", "ix_genes_id"),
        ("research_papers", "ix_research_papers_id"),
        ("sequences", "ix_sequences_id"),
    ]:
        try:
            bind = op.get_bind()
            inspector = sa.inspect(bind)
            tables = inspector.get_table_names()
            if table in tables and not _index_exists(table, index):
                op.create_index(index, table, ["id"])
        except Exception:
            # Non-fatal: SQLite primary keys are always indexed internally.
            pass


def downgrade() -> None:
    # Nothing to reverse.
    pass
