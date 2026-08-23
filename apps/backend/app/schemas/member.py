import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.core.config import settings


def _proxy_url(v: str | None) -> str | None:
    """Rewrite a raw R2 URL to the backend proxy URL if API_BASE_URL is set."""
    if not v or not settings.API_BASE_URL:
        return v
    idx = v.find("uploads/")
    if idx == -1:
        return v
    key = v[idx:]  # "uploads/..."
    return f"{settings.API_BASE_URL}/web/v1/assets/{key}"


class MemberPublic(BaseModel):
    """Public website view — constructed manually from Membership + User + Cohort."""
    id: uuid.UUID
    name: str
    email: str
    role: str
    role_title: str
    is_active: bool
    major: str | None
    grad_year: str | None
    hometown: str | None
    campus_involvements: str | None
    professional_experience: str | None
    professional_is_interests: bool
    interests: str | None
    bio: str | None
    headshot_url: str | None
    headshot_focal_x: float = 50.0
    headshot_focal_y: float = 50.0
    linkedin_url: str | None
    cohort_semester: str

    model_config = {"from_attributes": True}

    @field_validator("headshot_url", mode="before")
    @classmethod
    def proxy_headshot(cls, v: str | None) -> str | None:
        return _proxy_url(v)


# ---------------------------------------------------------------------------
# Ops tool schemas
# ---------------------------------------------------------------------------

class MembershipPublic(BaseModel):
    """Full membership record for the internal ops tool."""
    id: uuid.UUID
    user_id: uuid.UUID
    cohort_id: uuid.UUID | None
    role_title: str
    headshot_url: str | None
    headshot_focal_x: float
    headshot_focal_y: float
    hometown: str | None
    major: str | None
    grad_year: str | None
    campus_involvements: str | None
    professional_experience: str | None
    professional_is_interests: bool
    interests: str | None
    bio: str | None
    linkedin_url: str | None
    display_order: int
    is_active: bool
    website_role: str | None

    model_config = {"from_attributes": True}

    @field_validator("headshot_url", mode="before")
    @classmethod
    def proxy_headshot(cls, v: str | None) -> str | None:
        return _proxy_url(v)


class MembershipCreate(BaseModel):
    user_id: uuid.UUID
    cohort_id: uuid.UUID | None
    role_title: str = "Analyst"
    headshot_url: str | None = None
    hometown: str | None = None
    major: str | None = None
    grad_year: str | None = None
    campus_involvements: str | None = None
    professional_experience: str | None = None
    interests: str | None = None
    bio: str | None = None
    linkedin_url: str | None = None
    display_order: int = 0
    is_active: bool = True


class MembershipUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role_title: str | None = None
    headshot_url: str | None = None
    headshot_focal_x: float | None = None
    headshot_focal_y: float | None = None
    hometown: str | None = None
    major: str | None = None
    grad_year: str | None = None
    campus_involvements: str | None = None
    professional_experience: str | None = None
    professional_is_interests: bool | None = None
    interests: str | None = None
    bio: str | None = None
    linkedin_url: str | None = None
    display_order: int | None = None
    is_active: bool | None = None
    website_role: str | None = None


class MembershipDetail(MembershipPublic):
    """Single-record response — includes the linked user's name, email, and role."""
    user_name: str
    user_email: str
    user_role: str


class ProfileEditRequestCreate(BaseModel):
    changes: dict  # { field_name: new_value }


class ProfileEditRequestPublic(BaseModel):
    id: uuid.UUID
    membership_id: uuid.UUID
    reviewed_by_id: uuid.UUID | None
    changes: dict
    status: str
    reviewer_note: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProfileEditReview(BaseModel):
    status: str  # "approved" | "rejected"
    reviewer_note: str | None = None
