import uuid

from pydantic import BaseModel

from app.models.user import UserRole


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
