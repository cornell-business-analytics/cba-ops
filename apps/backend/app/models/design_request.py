import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class DesignRequestStatus(str, enum.Enum):
    pending = "pending"
    rejected = "rejected"
    approved = "approved"
    dispatch_failed = "dispatch_failed"
    agent_running = "agent_running"
    agent_failed = "agent_failed"
    pr_open = "pr_open"
    merge_failed = "merge_failed"
    merged = "merged"
    discarded = "discarded"


class DesignRequest(UUIDMixin, TimestampMixin, Base):
    """A member-proposed website design change, carried out by an AI coding
    agent (see .github/workflows/design-agent.yml) after director approval.

    status is a plain string (not a native Postgres enum) because this set
    keeps growing as failure/retry states get added — matches
    ProfileEditRequest.status rather than PageStatus.
    """
    __tablename__ = "design_requests"

    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(
        String(30), default=DesignRequestStatus.pending.value, nullable=False, index=True
    )

    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    branch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    workflow_run_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    agent_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    agent_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Populated lazily by GET /design-requests/{id}/status polling the GitHub
    # Deployments API, not by the agent callback — the callback fires right
    # after `gh pr create`, before Vercel's preview build necessarily exists.
    preview_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    confirmed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merge_commit_sha: Mapped[str | None] = mapped_column(String(100), nullable=True)
    discarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    requested_by: Mapped["User | None"] = relationship(foreign_keys=[requested_by_id])  # noqa: F821
    reviewed_by: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by_id])  # noqa: F821
    confirmed_by: Mapped["User | None"] = relationship(foreign_keys=[confirmed_by_id])  # noqa: F821
