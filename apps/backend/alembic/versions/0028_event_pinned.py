"""Add is_pinned to events

Revision ID: 0028_event_pinned
Revises: 0027_event_unpublish_at
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0028_event_pinned"
down_revision = "0027_event_unpublish_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("events", "is_pinned")
