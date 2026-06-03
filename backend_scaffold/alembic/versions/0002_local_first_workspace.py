"""local first bioinformatics workspace

Revision ID: 0002_local_first_workspace
Revises: 0001_initial_schema
Create Date: 2026-05-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_local_first_workspace"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _create_index_once(index_name: str, table_name: str, columns: list[str], unique: bool = False) -> None:
    if not _index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    if _table_exists("search_history"):
        with op.batch_alter_table("search_history") as batch_op:
            if not _column_exists("search_history", "mode"):
                batch_op.add_column(sa.Column("mode", sa.String(length=50), nullable=False, server_default="local_first"))
            if not _column_exists("search_history", "result_source"):
                batch_op.add_column(sa.Column("result_source", sa.String(length=100), nullable=False, server_default="unknown"))
            if not _column_exists("search_history", "result_count"):
                batch_op.add_column(sa.Column("result_count", sa.Integer(), nullable=False, server_default="0"))
        _create_index_once("ix_search_history_mode", "search_history", ["mode"])
        _create_index_once("ix_search_history_result_source", "search_history", ["result_source"])

    if not _table_exists("genes"):
        op.create_table(
            "genes",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("symbol", sa.String(length=100), nullable=False),
            sa.Column("name", sa.String(length=500), nullable=False, server_default=""),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("organism", sa.String(length=255), nullable=False, server_default="Unknown"),
            sa.Column("ncbi_gene_id", sa.String(length=100), nullable=True),
            sa.Column("source", sa.String(length=50), nullable=False, server_default="local"),
            sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("symbol", "organism", name="uq_gene_symbol_organism"),
        )
    _create_index_once("ix_genes_symbol", "genes", ["symbol"])
    _create_index_once("ix_genes_organism", "genes", ["organism"])
    _create_index_once("ix_genes_ncbi_gene_id", "genes", ["ncbi_gene_id"])
    _create_index_once("ix_genes_source", "genes", ["source"])

    if not _table_exists("research_papers"):
        op.create_table(
            "research_papers",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("abstract", sa.Text(), nullable=False, server_default=""),
            sa.Column("journal", sa.String(length=500), nullable=False, server_default=""),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("authors", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("doi", sa.String(length=255), nullable=True),
            sa.Column("pubmed_id", sa.String(length=100), nullable=True, unique=True),
            sa.Column("source", sa.String(length=50), nullable=False, server_default="local"),
            sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    _create_index_once("ix_research_papers_year", "research_papers", ["year"])
    _create_index_once("ix_research_papers_doi", "research_papers", ["doi"])
    _create_index_once("ix_research_papers_pubmed_id", "research_papers", ["pubmed_id"], unique=True)
    _create_index_once("ix_research_papers_source", "research_papers", ["source"])

    if not _table_exists("sequences"):
        op.create_table(
            "sequences",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("name", sa.String(length=255), nullable=False, server_default="Untitled sequence"),
            sa.Column("sequence", sa.Text(), nullable=False),
            sa.Column("sequence_length", sa.Integer(), nullable=False),
            sa.Column("gc_content_percent", sa.Float(), nullable=False),
            sa.Column("at_content_percent", sa.Float(), nullable=False),
            sa.Column("analysis", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("source", sa.String(length=50), nullable=False, server_default="user_input"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    _create_index_once("ix_sequences_name", "sequences", ["name"])
    _create_index_once("ix_sequences_sequence_length", "sequences", ["sequence_length"])
    _create_index_once("ix_sequences_gc_content_percent", "sequences", ["gc_content_percent"])
    _create_index_once("ix_sequences_at_content_percent", "sequences", ["at_content_percent"])
    _create_index_once("ix_sequences_source", "sequences", ["source"])


def downgrade() -> None:
    for index_name in [
        "ix_sequences_source",
        "ix_sequences_at_content_percent",
        "ix_sequences_gc_content_percent",
        "ix_sequences_sequence_length",
        "ix_sequences_name",
    ]:
        if _index_exists("sequences", index_name):
            op.drop_index(index_name, table_name="sequences")
    if _table_exists("sequences"):
        op.drop_table("sequences")

    for index_name in [
        "ix_research_papers_source",
        "ix_research_papers_pubmed_id",
        "ix_research_papers_doi",
        "ix_research_papers_year",
    ]:
        if _index_exists("research_papers", index_name):
            op.drop_index(index_name, table_name="research_papers")
    if _table_exists("research_papers"):
        op.drop_table("research_papers")

    for index_name in ["ix_genes_source", "ix_genes_ncbi_gene_id", "ix_genes_organism", "ix_genes_symbol"]:
        if _index_exists("genes", index_name):
            op.drop_index(index_name, table_name="genes")
    if _table_exists("genes"):
        op.drop_table("genes")

    if _table_exists("search_history"):
        with op.batch_alter_table("search_history") as batch_op:
            if _index_exists("search_history", "ix_search_history_result_source"):
                batch_op.drop_index("ix_search_history_result_source")
            if _index_exists("search_history", "ix_search_history_mode"):
                batch_op.drop_index("ix_search_history_mode")
            if _column_exists("search_history", "result_count"):
                batch_op.drop_column("result_count")
            if _column_exists("search_history", "result_source"):
                batch_op.drop_column("result_source")
            if _column_exists("search_history", "mode"):
                batch_op.drop_column("mode")
