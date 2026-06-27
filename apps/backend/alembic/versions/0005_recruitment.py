"""Add recruitment tables (cycles, applicants, gmail tokens)

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "recruitment_cycles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("sheet_id", sa.String(200), nullable=True),
        sa.Column("pairing_subject", sa.String(200), nullable=False,
                  server_default="[Response Requested] CBA Coffee Chat Pairing"),
        sa.Column("pairing_body", sa.Text, nullable=False, server_default=""),
        sa.Column("rejection_subject", sa.String(200), nullable=False,
                  server_default="[Update] CBA Coffee Chat Request"),
        sa.Column("rejection_body", sa.Text, nullable=False, server_default=""),
        sa.Column("sender_name", sa.String(100), nullable=False, server_default=""),
        sa.Column("sender_title", sa.String(100), nullable=False, server_default="Director of Recruitment"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "coffee_chat_applicants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("recruitment_cycles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200), nullable=False),
        sa.Column("netid", sa.String(50), nullable=False),
        sa.Column("grad_date", sa.String(50), nullable=True),
        sa.Column("major", sa.String(200), nullable=True),
        sa.Column("requested_member_raw", sa.String(200), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("paired_membership_id", UUID(as_uuid=True), sa.ForeignKey("memberships.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("pairing_status", sa.String(30), nullable=False, server_default="unpaired"),
        sa.Column("gmail_message_id", sa.String(200), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "gmail_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("access_token", sa.Text, nullable=False),
        sa.Column("refresh_token", sa.Text, nullable=False),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("account_email", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade():
    op.drop_table("coffee_chat_applicants")
    op.drop_table("recruitment_cycles")
    op.drop_table("gmail_tokens")
