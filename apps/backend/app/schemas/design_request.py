import re
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

_SAFE_PATH = re.compile(r"^[\w\-./]+\.(png|jpg|jpeg|gif|webp|avif|svg)$", re.IGNORECASE)


class DesignRequestCreate(BaseModel):
    description: str
    attachment_url: str | None = None
    target_path: str | None = None

    @field_validator("target_path")
    @classmethod
    def validate_target_path(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if ".." in v or v.startswith("/"):
            raise ValueError("Invalid target path")
        if not _SAFE_PATH.match(v):
            raise ValueError("target_path must be a relative image filename")
        return v


class DesignRequestPublic(BaseModel):
    id: uuid.UUID
    requested_by_id: uuid.UUID | None
    description: str
    attachment_url: str | None
    target_path: str | None
    status: str

    reviewed_by_id: uuid.UUID | None
    reviewer_note: str | None
    reviewed_at: datetime | None

    branch_name: str | None
    pr_number: int | None
    pr_url: str | None

    dispatched_at: datetime | None
    agent_completed_at: datetime | None
    agent_error: str | None

    preview_url: str | None

    confirmed_by_id: uuid.UUID | None
    confirmed_at: datetime | None
    merged_at: datetime | None
    discarded_at: datetime | None

    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DesignRequestReview(BaseModel):
    status: str  # "approved" | "rejected"
    reviewer_note: str | None = None


class DesignRequestRevise(BaseModel):
    revision_note: str


class AgentCallback(BaseModel):
    request_id: uuid.UUID
    outcome: str  # "success" | "failure"
    branch_name: str | None = None
    pr_number: int | None = None
    pr_url: str | None = None
    workflow_run_id: str | None = None
    error_message: str | None = None


class DesignRequestStatusCheck(BaseModel):
    ci_status: str | None  # "success" | "failure" | "pending" | None (no checks yet)
    preview_url: str | None
    mergeable: bool | None
    pr_url: str | None
