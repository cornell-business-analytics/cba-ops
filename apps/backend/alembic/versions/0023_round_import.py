"""Add score_sheet_url to interview_rounds; unique constraint on interview_scores

Revision ID: 0023_round_import
Revises: 0022_cand_import
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0023_round_import"
down_revision = "0022_cand_import"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_rounds", sa.Column("score_sheet_url", sa.String(500), nullable=True))
    op.create_unique_constraint(
        "uq_interview_score",
        "interview_scores",
        ["session_id", "candidate_id", "member_id", "category_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_interview_score", "interview_scores", type_="unique")
    op.drop_column("interview_rounds", "score_sheet_url")
