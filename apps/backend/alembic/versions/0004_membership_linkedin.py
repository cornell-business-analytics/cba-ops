"""Add linkedin_url to memberships

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("memberships", sa.Column("linkedin_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("memberships", "linkedin_url")
