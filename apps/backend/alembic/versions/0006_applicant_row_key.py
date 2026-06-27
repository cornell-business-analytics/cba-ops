"""Add row_key to coffee_chat_applicants for per-submission dedup

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "coffee_chat_applicants",
        sa.Column("row_key", sa.String(200), nullable=True),
    )


def downgrade():
    op.drop_column("coffee_chat_applicants", "row_key")
