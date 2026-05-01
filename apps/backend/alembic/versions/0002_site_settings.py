"""Site settings table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-30
"""
import json
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

DEFAULT_STEPS = [
    {"title": "Attend an info session", "desc": "Learn about CBA and meet current members. No commitment required."},
    {"title": "Submit your application", "desc": "A short form covering your background, interests, and a brief analytical question."},
    {"title": "Coffee chat", "desc": "A casual conversation with a current member to get to know you."},
    {"title": "Case interview", "desc": "A structured case to assess your analytical thinking. We provide prep resources."},
    {"title": "Decisions", "desc": "We notify all applicants within one week of final interviews."},
]


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute(
        sa.text("INSERT INTO site_settings (key, value) VALUES (:key, :value)").bindparams(
            key="recruitment_steps",
            value=json.dumps(DEFAULT_STEPS),
        )
    )


def downgrade() -> None:
    op.drop_table("site_settings")
