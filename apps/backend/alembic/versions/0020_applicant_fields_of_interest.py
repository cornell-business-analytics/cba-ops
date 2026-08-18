"""Add fields_of_interest to coffee_chat_applicants

Revision ID: 0020_applicant_fields_of_interest
Revises: 0019_event_link
Create Date: 2026-08-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0020_applicant_fields_of_interest"
down_revision = "0019_event_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "coffee_chat_applicants",
        sa.Column("fields_of_interest", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("coffee_chat_applicants", "fields_of_interest")
