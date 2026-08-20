"""Add gender_identity, ethnicity to candidates; column_mapping to application_cycles

Revision ID: 0022_cand_import
Revises: 0021_eval
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0022_cand_import"
down_revision = "0021_eval"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("gender_identity", sa.String(200), nullable=True))
    op.add_column("candidates", sa.Column("ethnicity", JSONB, nullable=True))
    op.add_column("application_cycles", sa.Column("column_mapping", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("application_cycles", "column_mapping")
    op.drop_column("candidates", "ethnicity")
    op.drop_column("candidates", "gender_identity")
