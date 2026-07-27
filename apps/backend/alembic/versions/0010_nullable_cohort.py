"""make cohort_id nullable on memberships

Revision ID: 0010_nullable_cohort
Revises: 0009_headshot_focal_point
Create Date: 2026-07-27
"""
from alembic import op

revision = "0010_nullable_cohort"
down_revision = "0009_headshot_focal_point"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE memberships ALTER COLUMN cohort_id DROP NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE memberships ALTER COLUMN cohort_id SET NOT NULL")
