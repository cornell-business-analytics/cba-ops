import enum
import uuid

from sqlalchemy import Boolean, Date, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class CandidateStatus(str, enum.Enum):
    applied = "applied"
    coffee_chat = "coffee_chat"
    interviewing = "interviewing"
    offer = "offer"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


class ScoreFormat(str, enum.Enum):
    numeric = "numeric"   # 0–5 float
    ynm = "ynm"           # Y / M / N


class InterviewFormat(str, enum.Enum):
    group = "group"
    individual = "individual"


# ---------------------------------------------------------------------------
# Application cycle
# ---------------------------------------------------------------------------

class ApplicationCycle(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "application_cycles"

    name: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)  # e.g. "SP26"
    open_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    close_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="cycle")
    interview_rounds: Mapped[list["InterviewRound"]] = relationship(back_populates="cycle")


# ---------------------------------------------------------------------------
# Configurable interview structure
# ---------------------------------------------------------------------------

class InterviewRound(UUIDMixin, TimestampMixin, Base):
    """One round in the interview process, configurable per cycle."""
    __tablename__ = "interview_rounds"

    cycle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("application_cycles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)          # e.g. "Round 1"
    score_format: Mapped[ScoreFormat] = mapped_column(Enum(ScoreFormat), nullable=False)
    interview_format: Mapped[InterviewFormat] = mapped_column(Enum(InterviewFormat), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    cycle: Mapped["ApplicationCycle"] = relationship(back_populates="interview_rounds")
    categories: Mapped[list["InterviewCategory"]] = relationship(back_populates="round")
    sessions: Mapped[list["InterviewSession"]] = relationship(back_populates="round")


class InterviewCategory(UUIDMixin, Base):
    """A scoring category within a round (e.g. 'Why CBA?', 'Brainteasers')."""
    __tablename__ = "interview_categories"

    round_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interview_rounds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    round: Mapped["InterviewRound"] = relationship(back_populates="categories")


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------

class InterviewSession(UUIDMixin, TimestampMixin, Base):
    """A scheduled block: a specific time slot + group within a round."""
    __tablename__ = "interview_sessions"

    round_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interview_rounds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_label: Mapped[str] = mapped_column(String(50), nullable=False)       # e.g. "Group 1"
    time_slot: Mapped[str] = mapped_column(String(50), nullable=False)          # e.g. "5:00 PM"
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    round: Mapped["InterviewRound"] = relationship(back_populates="sessions")
    assignments: Mapped[list["InterviewAssignment"]] = relationship(back_populates="session")
    scores: Mapped[list["InterviewScore"]] = relationship(back_populates="session")


class InterviewAssignment(UUIDMixin, Base):
    """Which members are assigned to score a session."""
    __tablename__ = "interview_assignments"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    session: Mapped["InterviewSession"] = relationship(back_populates="assignments")


# ---------------------------------------------------------------------------
# Candidate
# ---------------------------------------------------------------------------

class Candidate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "candidates"

    cycle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("application_cycles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Application fields
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cornell_email: Mapped[str] = mapped_column(String(255), nullable=False)
    net_id: Mapped[str] = mapped_column(String(50), nullable=False)
    pronouns: Mapped[str | None] = mapped_column(String(50), nullable=True)
    grad_year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_transfer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    college: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)   # multi-select
    major: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    headshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Pipeline
    status: Mapped[CandidateStatus] = mapped_column(
        Enum(CandidateStatus), default=CandidateStatus.applied, nullable=False, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)  # internal EBoard notes

    cycle: Mapped["ApplicationCycle"] = relationship(back_populates="candidates")
    di_data: Mapped["CandidateDIData | None"] = relationship(back_populates="candidate", uselist=False)
    coffee_chats: Mapped[list["CoffeeChat"]] = relationship(back_populates="candidate")
    interview_scores: Mapped[list["InterviewScore"]] = relationship(back_populates="candidate")


class CandidateDIData(UUIDMixin, TimestampMixin, Base):
    """D&I data — EBoard access only."""
    __tablename__ = "candidate_di_data"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    gender_identity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    race_ethnicity: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    candidate: Mapped["Candidate"] = relationship(back_populates="di_data")


# ---------------------------------------------------------------------------
# Coffee chats
# ---------------------------------------------------------------------------

class CoffeeChat(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "coffee_chats"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)   # 0–3
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    candidate: Mapped["Candidate"] = relationship(back_populates="coffee_chats")


# ---------------------------------------------------------------------------
# Interview scoring
# ---------------------------------------------------------------------------

class InterviewScore(UUIDMixin, TimestampMixin, Base):
    """One member's score for one candidate in one session for one category."""
    __tablename__ = "interview_scores"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interview_categories.id", ondelete="CASCADE"), nullable=False
    )

    numeric_score: Mapped[float | None] = mapped_column(Float, nullable=True)   # for numeric rounds
    ynm_score: Mapped[str | None] = mapped_column(String(5), nullable=True)      # Y / M / N / Y/M / M/N
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped["InterviewSession"] = relationship(back_populates="scores")
    candidate: Mapped["Candidate"] = relationship(back_populates="interview_scores")
