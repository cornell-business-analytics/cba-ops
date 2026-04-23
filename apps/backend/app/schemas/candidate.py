import uuid

from pydantic import BaseModel

from app.models.candidate import CandidateStatus


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
    resume_url: str | None
    headshot_url: str | None
    status: CandidateStatus
    notes: str | None

    model_config = {"from_attributes": True}


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
