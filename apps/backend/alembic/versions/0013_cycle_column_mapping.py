"""Add column_mapping JSONB to recruitment_cycles

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-07
"""

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

_DEFAULT = json.dumps({
    "name_col": "Full Name",
    "email_col": "Cornell Email Address",
    "grad_col": "Graduation Date",
    "major_col": "Intended Major(s)",
    "request_col": "Paired Member",
    "timestamp_col": "Timestamp",
})


def upgrade() -> None:
    op.add_column(
        "recruitment_cycles",
        sa.Column("column_mapping", JSONB, nullable=False, server_default=_DEFAULT),
    )


def downgrade() -> None:
    op.drop_column("recruitment_cycles", "column_mapping")
