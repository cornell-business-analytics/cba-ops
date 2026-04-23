import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Cohort(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "cohorts"

    semester: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)  # e.g. "SP26"

    memberships: Mapped[list["Membership"]] = relationship(back_populates="cohort")
    projects: Mapped[list["Project"]] = relationship(back_populates="cohort")  # noqa: F821


class Membership(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "memberships"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cohort_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cohorts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Public profile fields
    role_title: Mapped[str] = mapped_column(String(100), nullable=False, default="Analyst")
    headshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hometown: Mapped[str | None] = mapped_column(String(100), nullable=True)
    major: Mapped[str | None] = mapped_column(String(200), nullable=True)
    grad_year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    campus_involvements: Mapped[str | None] = mapped_column(Text, nullable=True)
    professional_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    interests: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Private fields
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="memberships")  # noqa: F821
    cohort: Mapped["Cohort"] = relationship(back_populates="memberships")
    project: Mapped["Project | None"] = relationship(back_populates="members")  # noqa: F821
    profile_edit_requests: Mapped[list["ProfileEditRequest"]] = relationship(back_populates="membership")


class ProfileEditRequest(UUIDMixin, TimestampMixin, Base):
    """Pending profile edits that require Director/EBoard approval."""
    __tablename__ = "profile_edit_requests"

    membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memberships.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    changes: Mapped[dict] = mapped_column(__import__("sqlalchemy.dialects.postgresql", fromlist=["JSONB"]).JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending | approved | rejected
    reviewer_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    membership: Mapped["Membership"] = relationship(back_populates="profile_edit_requests")
