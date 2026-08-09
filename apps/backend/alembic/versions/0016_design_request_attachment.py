"""Add attachment_url and target_path to design_requests

Revision ID: 0016_design_request_attachment
Revises: 0015_design_requests
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa

revision = "0016_design_request_attachment"
down_revision = "0015_design_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("design_requests", sa.Column("attachment_url", sa.Text(), nullable=True))
    op.add_column("design_requests", sa.Column("target_path", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("design_requests", "target_path")
    op.drop_column("design_requests", "attachment_url")
