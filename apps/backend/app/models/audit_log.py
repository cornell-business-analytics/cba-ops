import uuid

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# JSON().with_variant(JSONB, "postgresql") renders as JSONB against Postgres
# (matching the already-migrated production column) but as plain JSON
# against SQLite, which the async test suite uses and which has no JSONB
# dialect support — without this, any test touching this table fails at
# CREATE TABLE time.
_PayloadType = JSON().with_variant(JSONB, "postgresql")


class AuditLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payload: Mapped[dict | None] = mapped_column(_PayloadType, nullable=True)
