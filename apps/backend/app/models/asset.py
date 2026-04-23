import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Asset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assets"

    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    uploaded_by: Mapped["User | None"] = relationship()  # noqa: F821
