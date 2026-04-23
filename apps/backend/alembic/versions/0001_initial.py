"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("google_sub", sa.String(255), nullable=False, unique=True),
        sa.Column("role", sa.Enum("member", "pm", "director", "eboard", name="userrole"), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # user_sessions
    op.create_table(
        "user_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(255), nullable=False),
        sa.Column("is_revoked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])

    # cohorts
    op.create_table(
        "cohorts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("semester", sa.String(20), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # projects (before memberships — membership references projects)
    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cohort_id", UUID(as_uuid=True), sa.ForeignKey("cohorts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_projects_cohort_id", "projects", ["cohort_id"])

    # memberships
    op.create_table(
        "memberships",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cohort_id", UUID(as_uuid=True), sa.ForeignKey("cohorts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role_title", sa.String(100), nullable=False, server_default="Analyst"),
        sa.Column("headshot_url", sa.String(500), nullable=True),
        sa.Column("hometown", sa.String(100), nullable=True),
        sa.Column("major", sa.String(200), nullable=True),
        sa.Column("grad_year", sa.String(20), nullable=True),
        sa.Column("campus_involvements", sa.Text, nullable=True),
        sa.Column("professional_experience", sa.Text, nullable=True),
        sa.Column("interests", sa.Text, nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_index("ix_memberships_cohort_id", "memberships", ["cohort_id"])

    # profile_edit_requests
    op.create_table(
        "profile_edit_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("membership_id", UUID(as_uuid=True), sa.ForeignKey("memberships.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewed_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("changes", JSONB, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewer_note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_profile_edit_requests_membership_id", "profile_edit_requests", ["membership_id"])

    # application_cycles
    op.create_table(
        "application_cycles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(20), nullable=False, unique=True),
        sa.Column("open_date", sa.Date, nullable=True),
        sa.Column("close_date", sa.Date, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # interview_rounds
    op.create_table(
        "interview_rounds",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("application_cycles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round_number", sa.Integer, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("score_format", sa.Enum("numeric", "ynm", name="scoreformat"), nullable=False),
        sa.Column("interview_format", sa.Enum("group", "individual", name="interviewformat"), nullable=False),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_interview_rounds_cycle_id", "interview_rounds", ["cycle_id"])

    # interview_categories
    op.create_table(
        "interview_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("round_id", UUID(as_uuid=True), sa.ForeignKey("interview_rounds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_interview_categories_round_id", "interview_categories", ["round_id"])

    # interview_sessions
    op.create_table(
        "interview_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("round_id", UUID(as_uuid=True), sa.ForeignKey("interview_rounds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("group_label", sa.String(50), nullable=False),
        sa.Column("time_slot", sa.String(50), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_interview_sessions_round_id", "interview_sessions", ["round_id"])

    # interview_assignments
    op.create_table(
        "interview_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_interview_assignments_session_id", "interview_assignments", ["session_id"])

    # candidates
    op.create_table(
        "candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", UUID(as_uuid=True), sa.ForeignKey("application_cycles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("cornell_email", sa.String(255), nullable=False),
        sa.Column("net_id", sa.String(50), nullable=False),
        sa.Column("pronouns", sa.String(50), nullable=True),
        sa.Column("grad_year", sa.String(20), nullable=True),
        sa.Column("is_transfer", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("college", JSONB, nullable=False, server_default="[]"),
        sa.Column("major", sa.String(255), nullable=True),
        sa.Column("resume_url", sa.String(500), nullable=True),
        sa.Column("headshot_url", sa.String(500), nullable=True),
        sa.Column("status", sa.Enum("applied", "coffee_chat", "interviewing", "offer", "accepted", "rejected", "withdrawn", name="candidatestatus"), nullable=False, server_default="applied"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_candidates_cycle_id", "candidates", ["cycle_id"])
    op.create_index("ix_candidates_email", "candidates", ["email"])
    op.create_index("ix_candidates_status", "candidates", ["status"])

    # candidate_di_data
    op.create_table(
        "candidate_di_data",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("gender_identity", sa.String(100), nullable=True),
        sa.Column("race_ethnicity", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # coffee_chats
    op.create_table(
        "coffee_chats",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("completed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_coffee_chats_candidate_id", "coffee_chats", ["candidate_id"])

    # interview_scores
    op.create_table(
        "interview_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", UUID(as_uuid=True), sa.ForeignKey("interview_categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("numeric_score", sa.Float, nullable=True),
        sa.Column("ynm_score", sa.String(5), nullable=True),
        sa.Column("comments", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_interview_scores_session_id", "interview_scores", ["session_id"])
    op.create_index("ix_interview_scores_candidate_id", "interview_scores", ["candidate_id"])

    # events
    op.create_table(
        "events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("type", sa.Enum("recruitment", "workshop", "speaker", "social", "other", name="eventtype"), nullable=False),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_events_slug", "events", ["slug"])
    op.create_index("ix_events_type", "events", ["type"])

    # pages
    op.create_table(
        "pages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("status", sa.Enum("draft", "review", "published", name="pagestatus"), nullable=False, server_default="draft"),
        sa.Column("seo_title", sa.String(255), nullable=True),
        sa.Column("seo_description", sa.Text, nullable=True),
        sa.Column("blocks", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pages_slug", "pages", ["slug"])


def downgrade() -> None:
    op.drop_table("pages")
    op.drop_table("events")
    op.drop_table("interview_scores")
    op.drop_table("coffee_chats")
    op.drop_table("candidate_di_data")
    op.drop_table("candidates")
    op.drop_table("interview_assignments")
    op.drop_table("interview_sessions")
    op.drop_table("interview_categories")
    op.drop_table("interview_rounds")
    op.drop_table("application_cycles")
    op.drop_table("profile_edit_requests")
    op.drop_table("memberships")
    op.drop_table("projects")
    op.drop_table("cohorts")
    op.drop_table("user_sessions")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS candidatestatus")
    op.execute("DROP TYPE IF EXISTS scoreformat")
    op.execute("DROP TYPE IF EXISTS interviewformat")
    op.execute("DROP TYPE IF EXISTS eventtype")
    op.execute("DROP TYPE IF EXISTS pagestatus")
