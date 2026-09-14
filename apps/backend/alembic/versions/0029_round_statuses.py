"""Add round_1, round_2, round_3 candidate statuses

Revision ID: 0029_round_statuses
Revises: 0028_event_pinned
Create Date: 2026-09-14
"""

from alembic import op

revision = "0029_round_statuses"
down_revision = "0028_event_pinned"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE candidatestatus ADD VALUE IF NOT EXISTS 'round_1'")
    op.execute("ALTER TYPE candidatestatus ADD VALUE IF NOT EXISTS 'round_2'")
    op.execute("ALTER TYPE candidatestatus ADD VALUE IF NOT EXISTS 'round_3'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; left as no-op
    pass
