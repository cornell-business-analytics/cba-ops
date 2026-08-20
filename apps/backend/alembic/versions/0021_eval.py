"""Add coffee_chat_evaluations table and evaluation_sheet_id to recruitment_cycles

Revision ID: 0021_eval
Revises: 0020_applicant_interests
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0021_eval"
down_revision = "0020_applicant_interests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "recruitment_cycles",
        sa.Column("evaluation_sheet_id", sa.String(500), nullable=True),
    )
    op.create_table(
        "coffee_chat_evaluations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cycle_id", sa.UUID(), nullable=False),
        sa.Column("row_key", sa.String(300), nullable=False),
        sa.Column("applicant_name", sa.String(200), nullable=False),
        sa.Column("applicant_email", sa.String(200), nullable=False),
        sa.Column("member_name", sa.String(200), nullable=False),
        sa.Column("chat_date", sa.String(100), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["cycle_id"], ["recruitment_cycles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cc_evals_cycle_id", "coffee_chat_evaluations", ["cycle_id"])
    op.create_index("ix_cc_evals_applicant_email", "coffee_chat_evaluations", ["applicant_email"])


def downgrade() -> None:
    op.drop_index("ix_cc_evals_applicant_email", table_name="coffee_chat_evaluations")
    op.drop_index("ix_cc_evals_cycle_id", table_name="coffee_chat_evaluations")
    op.drop_table("coffee_chat_evaluations")
    op.drop_column("recruitment_cycles", "evaluation_sheet_id")
