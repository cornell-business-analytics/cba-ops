"""Add design_requests table

Revision ID: 0015_design_requests
Revises: 0014_cycle_sheet_url
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0015_design_requests"
down_revision = "0014_cycle_sheet_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "design_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "requested_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column(
            "reviewed_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("branch_name", sa.String(255), nullable=True),
        sa.Column("pr_number", sa.Integer(), nullable=True),
        sa.Column("pr_url", sa.String(500), nullable=True),
        sa.Column("workflow_run_id", sa.String(100), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("agent_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("agent_error", sa.Text(), nullable=True),
        sa.Column("preview_url", sa.String(500), nullable=True),
        sa.Column(
            "confirmed_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merge_commit_sha", sa.String(100), nullable=True),
        sa.Column("discarded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_design_requests_requested_by_id", "design_requests", ["requested_by_id"])
    op.create_index("ix_design_requests_status", "design_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_design_requests_status", table_name="design_requests")
    op.drop_index("ix_design_requests_requested_by_id", table_name="design_requests")
    op.drop_table("design_requests")
