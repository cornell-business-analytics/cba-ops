"""add professional_is_interests to memberships

Revision ID: 0011_professional_is_interests
Revises: 0010_nullable_cohort
Create Date: 2026-08-02
"""
from alembic import op

revision = "0011_professional_is_interests"
down_revision = "0010_nullable_cohort"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE memberships ADD COLUMN professional_is_interests BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    op.execute("ALTER TABLE memberships DROP COLUMN professional_is_interests")
