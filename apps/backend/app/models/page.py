import enum

from sqlalchemy import Enum, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class PageStatus(str, enum.Enum):
    draft = "draft"
    review = "review"
    published = "published"


class Page(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "pages"

    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[PageStatus] = mapped_column(
        Enum(PageStatus), default=PageStatus.draft, nullable=False, index=True
    )
    seo_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    blocks: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
