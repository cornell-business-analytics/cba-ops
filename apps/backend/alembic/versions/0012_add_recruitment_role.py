"""add recruitment role to userrole enum

Revision ID: 0012_add_recruitment_role
Revises: 0011_professional_is_interests
Create Date: 2026-08-05
"""
from alembic import op

revision = "0012_add_recruitment_role"
down_revision = "0011_professional_is_interests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'recruitment' AFTER 'director'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # To downgrade, reassign any users with this role first, then recreate the type.
    op.execute("UPDATE users SET role = 'director' WHERE role = 'recruitment'")
