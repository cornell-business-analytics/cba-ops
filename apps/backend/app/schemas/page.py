import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.page import PageStatus


class PagePublic(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    seo_title: str | None
    seo_description: str | None
    blocks: list
    updated_at: datetime

    model_config = {"from_attributes": True}


class PageCreate(BaseModel):
    slug: str
    title: str
    seo_title: str | None = None
    seo_description: str | None = None
    blocks: list = []


class PageUpdate(BaseModel):
    title: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    blocks: list | None = None
    status: PageStatus | None = None
