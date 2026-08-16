"""Add user_id to gmail_tokens for per-user Gmail connections

Revision ID: 0018_gmail_token_user_id
Revises: 0017_audit_logs
Create Date: 2026-08-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0018_gmail_token_user_id"
down_revision = "0017_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "gmail_tokens",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_gmail_tokens_user_id", "gmail_tokens", ["user_id"], unique=True)
    op.create_foreign_key(
        "fk_gmail_tokens_user_id",
        "gmail_tokens", "users",
        ["user_id"], ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_gmail_tokens_user_id", "gmail_tokens", type_="foreignkey")
    op.drop_index("ix_gmail_tokens_user_id", table_name="gmail_tokens")
    op.drop_column("gmail_tokens", "user_id")
