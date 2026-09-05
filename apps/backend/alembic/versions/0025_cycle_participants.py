"""Add cycle_participants table

Revision ID: 0025_cycle_participants
Revises: 0024_eval_timestamps
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0025_cycle_participants"
down_revision = "0024_eval_timestamps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cycle_participants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("recruitment_cycles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("membership_id", UUID(as_uuid=True), sa.ForeignKey("memberships.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("cycle_id", "membership_id", name="uq_cycle_participant"),
    )


def downgrade() -> None:
    op.drop_table("cycle_participants")
