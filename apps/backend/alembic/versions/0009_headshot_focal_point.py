"""Add headshot focal point columns to memberships

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-20
"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("memberships", sa.Column("headshot_focal_x", sa.Float, nullable=False, server_default="50"))
    op.add_column("memberships", sa.Column("headshot_focal_y", sa.Float, nullable=False, server_default="50"))


def downgrade() -> None:
    op.drop_column("memberships", "headshot_focal_y")
    op.drop_column("memberships", "headshot_focal_x")
