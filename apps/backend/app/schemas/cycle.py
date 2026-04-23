import uuid
from datetime import date

from pydantic import BaseModel

from app.models.candidate import InterviewFormat, ScoreFormat


class InterviewCategoryPublic(BaseModel):
    id: uuid.UUID
    name: str
    display_order: int

    model_config = {"from_attributes": True}


class InterviewCategoryCreate(BaseModel):
    name: str
    display_order: int = 0


class InterviewRoundPublic(BaseModel):
    id: uuid.UUID
    round_number: int
    name: str
    score_format: ScoreFormat
    interview_format: InterviewFormat
    is_default: bool
    categories: list[InterviewCategoryPublic]

    model_config = {"from_attributes": True}


class InterviewRoundCreate(BaseModel):
    round_number: int
    name: str
    score_format: ScoreFormat
    interview_format: InterviewFormat
    is_default: bool = False
    categories: list[InterviewCategoryCreate] = []


class InterviewSessionPublic(BaseModel):
    id: uuid.UUID
    round_id: uuid.UUID
    group_label: str
    time_slot: str
    location: str | None

    model_config = {"from_attributes": True}


class InterviewSessionCreate(BaseModel):
    group_label: str
    time_slot: str
    location: str | None = None


class CyclePublic(BaseModel):
    id: uuid.UUID
    name: str
    open_date: date | None
    close_date: date | None
    is_active: bool

    model_config = {"from_attributes": True}


class CycleCreate(BaseModel):
    name: str
    open_date: date | None = None
    close_date: date | None = None
    is_active: bool = False


class CycleUpdate(BaseModel):
    open_date: date | None = None
    close_date: date | None = None
    is_active: bool | None = None
