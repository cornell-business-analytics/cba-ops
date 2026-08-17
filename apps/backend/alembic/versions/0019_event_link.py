"""Add an optional call-to-action link to events

Lets directors attach an RSVP form, Zoom room or signup sheet to an event from
the ops tool, rendered as a button on the public site.

Revision ID: 0019_event_link
Revises: 0018_gmail_token_user_id
Create Date: 2026-08-17
"""

import sqlalchemy as sa
from alembic import op

revision = "0019_event_link"
down_revision = "0018_gmail_token_user_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("link_url", sa.String(length=2048), nullable=True))
    op.add_column("events", sa.Column("link_label", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "link_label")
    op.drop_column("events", "link_url")
