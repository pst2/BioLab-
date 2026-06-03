"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cache_entries",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("cache_key", sa.String(length=255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cache_entries_cache_key", "cache_entries", ["cache_key"], unique=True)

    op.create_table(
        "search_history",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("query_type", sa.String(length=100), nullable=False),
        sa.Column("keyword", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_search_history_query_type", "search_history", ["query_type"])
    op.create_index("ix_search_history_keyword", "search_history", ["keyword"])

    op.create_table(
        "system_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_system_logs_level", "system_logs", ["level"])


def downgrade() -> None:
    op.drop_index("ix_system_logs_level", table_name="system_logs")
    op.drop_table("system_logs")

    op.drop_index("ix_search_history_keyword", table_name="search_history")
    op.drop_index("ix_search_history_query_type", table_name="search_history")
    op.drop_table("search_history")

    op.drop_index("ix_cache_entries_cache_key", table_name="cache_entries")
    op.drop_table("cache_entries")
