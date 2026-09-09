"""add_provenance_columns_to_genes_and_sequences

Revision ID: 21c9c5b3fc66
Revises: '4c0856d1f25a'
Create Date: 2026-09-09 11:07:12.438661

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21c9c5b3fc66'
down_revision: Union[str, None] = '4c0856d1f25a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- genes table ---
    op.add_column("genes", sa.Column("genome_assembly", sa.String(100), nullable=True))
    op.add_column("genes", sa.Column("taxid", sa.Integer(), nullable=True))
    op.add_column("genes", sa.Column("accession_version", sa.String(100), nullable=True))
    op.create_index("ix_genes_genome_assembly", "genes", ["genome_assembly"])
    op.create_index("ix_genes_taxid", "genes", ["taxid"])
    op.create_index("ix_genes_accession_version", "genes", ["accession_version"])


def downgrade() -> None:
    op.drop_index("ix_genes_accession_version", table_name="genes")
    op.drop_index("ix_genes_taxid", table_name="genes")
    op.drop_index("ix_genes_genome_assembly", table_name="genes")
    op.drop_column("genes", "accession_version")
    op.drop_column("genes", "taxid")
    op.drop_column("genes", "genome_assembly")
