"""Fix missing server_default on coffee_chat_evaluations timestamps

Revision ID: 0024_eval_timestamps
Revises: 0023_round_import
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0024_eval_timestamps"
down_revision = "0023_round_import"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "coffee_chat_evaluations",
        "created_at",
        server_default=sa.text("now()"),
    )
    op.alter_column(
        "coffee_chat_evaluations",
        "updated_at",
        server_default=sa.text("now()"),
    )


def downgrade() -> None:
    op.alter_column("coffee_chat_evaluations", "created_at", server_default=None)
    op.alter_column("coffee_chat_evaluations", "updated_at", server_default=None)
