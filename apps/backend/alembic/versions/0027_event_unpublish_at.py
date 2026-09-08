"""Add unpublish_at to events

Revision ID: 0027_event_unpublish_at
Revises: 0026_applicant_soft_delete
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

revision = "0027_event_unpublish_at"
down_revision = "0026_applicant_soft_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("unpublish_at", TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("events", "unpublish_at")
