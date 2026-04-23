import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.org import EventType


class EventPublic(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    description: str | None
    location: str | None
    event_date: datetime
    type: EventType
    is_published: bool

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    title: str
    slug: str
    description: str | None = None
    location: str | None = None
    event_date: datetime
    type: EventType
    is_published: bool = False


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    event_date: datetime | None = None
    type: EventType | None = None
    is_published: bool | None = None
