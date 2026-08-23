import uuid

from pydantic import BaseModel, field_validator

from app.models.candidate import CandidateStatus
from app.schemas.member import _proxy_url


class CandidateCreate(BaseModel):
    cycle_id: uuid.UUID
    name: str
    email: str
    cornell_email: str
    net_id: str
    pronouns: str | None = None
    grad_year: str | None = None
    is_transfer: bool = False
    college: list[str] = []
    major: str | None = None
    gender_identity: str | None = None
    ethnicity: list[str] = []
    resume_url: str | None = None
    headshot_url: str | None = None


class CandidatePublic(BaseModel):
    id: uuid.UUID
    cycle_id: uuid.UUID
    name: str
    email: str
    cornell_email: str
    net_id: str
    pronouns: str | None
    grad_year: str | None
    is_transfer: bool
    college: list
    major: str | None
    gender_identity: str | None
    ethnicity: list
    resume_url: str | None
    headshot_url: str | None
    status: CandidateStatus
    notes: str | None

    model_config = {"from_attributes": True}

    @field_validator("headshot_url", mode="before")
    @classmethod
    def proxy_headshot(cls, v: str | None) -> str | None:
        return _proxy_url(v)


class CandidateUpdate(BaseModel):
    notes: str | None = None
    headshot_url: str | None = None
    resume_url: str | None = None


class CandidateStatusUpdate(BaseModel):
    status: CandidateStatus


class CoffeeChatPublic(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    member_id: uuid.UUID
    member_name: str | None = None
    score: int | None
    notes: str | None
    completed: bool

    model_config = {"from_attributes": True}


class CoffeeChatAssign(BaseModel):
    member_id: uuid.UUID


class CoffeeChatUpdate(BaseModel):
    score: int | None = None
    notes: str | None = None
    completed: bool | None = None


class InterviewScoreCreate(BaseModel):
    session_id: uuid.UUID
    candidate_id: uuid.UUID
    category_id: uuid.UUID
    numeric_score: float | None = None
    ynm_score: str | None = None
    comments: str | None = None


class InterviewScorePublic(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    candidate_id: uuid.UUID
    member_id: uuid.UUID
    category_id: uuid.UUID
    numeric_score: float | None
    ynm_score: str | None
    comments: str | None

    model_config = {"from_attributes": True}
