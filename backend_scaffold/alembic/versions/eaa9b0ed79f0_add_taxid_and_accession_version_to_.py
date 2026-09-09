"""add_taxid_and_accession_version_to_sequences

Revision ID: eaa9b0ed79f0
Revises: '21c9c5b3fc66'
Create Date: 2026-09-09 22:53:41.702783

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eaa9b0ed79f0'
down_revision: Union[str, None] = '21c9c5b3fc66'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- sequences table ---
    op.add_column("sequences", sa.Column("taxid", sa.Integer(), nullable=True))
    op.add_column("sequences", sa.Column("accession_version", sa.String(100), nullable=True))
    op.create_index("ix_sequences_taxid", "sequences", ["taxid"])
    op.create_index("ix_sequences_accession_version", "sequences", ["accession_version"])


def downgrade() -> None:
    op.drop_index("ix_sequences_accession_version", table_name="sequences")
    op.drop_index("ix_sequences_taxid", table_name="sequences")
    op.drop_column("sequences", "accession_version")
    op.drop_column("sequences", "taxid")

