import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class RecruitmentCycle(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "recruitment_cycles"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sheet_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Editable email template fields
    pairing_subject: Mapped[str] = mapped_column(
        String(200), nullable=False,
        default="[Response Requested] CBA Coffee Chat Pairing"
    )
    pairing_body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    rejection_subject: Mapped[str] = mapped_column(
        String(200), nullable=False,
        default="[Update] CBA Coffee Chat Request"
    )
    rejection_body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sender_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    sender_title: Mapped[str] = mapped_column(String(100), nullable=False, default="Director of Recruitment")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    applicants: Mapped[list["CoffeeChatApplicant"]] = relationship(back_populates="cycle", cascade="all, delete-orphan")


class CoffeeChatApplicant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "coffee_chat_applicants"

    cycle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recruitment_cycles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    netid: Mapped[str] = mapped_column(String(50), nullable=False)
    grad_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    major: Mapped[str | None] = mapped_column(String(200), nullable=True)
    requested_member_raw: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pairing
    paired_membership_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memberships.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pairing_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="unpaired"
    )  # unpaired | paired | sent | rejected | needs_attention
    gmail_message_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cycle: Mapped["RecruitmentCycle"] = relationship(back_populates="applicants")
    paired_membership: Mapped["Membership | None"] = relationship()  # noqa: F821


class GmailToken(UUIDMixin, TimestampMixin, Base):
    """Singleton table — one row storing the Gmail OAuth token for the CBA account."""
    __tablename__ = "gmail_tokens"

    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    account_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
