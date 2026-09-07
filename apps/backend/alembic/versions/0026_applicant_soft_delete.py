"""Add is_deleted to coffee_chat_applicants

Revision ID: 0026_applicant_soft_delete
Revises: 0025_cycle_participants
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa

revision = "0026_applicant_soft_delete"
down_revision = "0025_cycle_participants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "coffee_chat_applicants",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("coffee_chat_applicants", "is_deleted")
