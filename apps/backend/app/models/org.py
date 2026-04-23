import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class EventType(str, enum.Enum):
    recruitment = "recruitment"
    workshop = "workshop"
    speaker = "speaker"
    social = "social"
    other = "other"


class Event(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "events"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False, index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
