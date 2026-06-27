"""Add website_role to memberships

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "memberships",
        sa.Column("website_role", sa.String(20), nullable=True),
    )


def downgrade():
    op.drop_column("memberships", "website_role")
