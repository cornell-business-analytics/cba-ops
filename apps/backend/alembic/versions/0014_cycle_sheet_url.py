"""Add sheet_url and widen name on application_cycles

Revision ID: 0014_cycle_sheet_url
Revises: 0013_cycle_column_mapping
Create Date: 2026-08-07
"""

from alembic import op
import sqlalchemy as sa

revision = "0014_cycle_sheet_url"
down_revision = "0013_cycle_column_mapping"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "application_cycles",
        sa.Column("sheet_url", sa.String(500), nullable=True),
    )
    op.alter_column("application_cycles", "name", type_=sa.String(100))


def downgrade() -> None:
    op.drop_column("application_cycles", "sheet_url")
    op.alter_column("application_cycles", "name", type_=sa.String(20))
