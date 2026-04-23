import uuid

from pydantic import BaseModel


class MemberPublic(BaseModel):
    """Public website view — constructed manually from Membership + User + Cohort."""
    id: uuid.UUID
    name: str
    email: str
    role_title: str
    major: str | None
    grad_year: str | None
    hometown: str | None
    campus_involvements: str | None
    professional_experience: str | None
    interests: str | None
    bio: str | None
    headshot_url: str | None
    cohort_semester: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Ops tool schemas
# ---------------------------------------------------------------------------

class MembershipPublic(BaseModel):
    """Full membership record for the internal ops tool."""
    id: uuid.UUID
    user_id: uuid.UUID
    cohort_id: uuid.UUID
    project_id: uuid.UUID | None
    role_title: str
    headshot_url: str | None
    hometown: str | None
    major: str | None
    grad_year: str | None
    campus_involvements: str | None
    professional_experience: str | None
    interests: str | None
    bio: str | None
    display_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class MembershipCreate(BaseModel):
    user_id: uuid.UUID
    cohort_id: uuid.UUID
    project_id: uuid.UUID | None = None
    role_title: str = "Analyst"
    headshot_url: str | None = None
    hometown: str | None = None
    major: str | None = None
    grad_year: str | None = None
    campus_involvements: str | None = None
    professional_experience: str | None = None
    interests: str | None = None
    bio: str | None = None
    display_order: int = 0
    is_active: bool = True


class MembershipUpdate(BaseModel):
    role_title: str | None = None
    project_id: uuid.UUID | None = None
    headshot_url: str | None = None
    hometown: str | None = None
    major: str | None = None
    grad_year: str | None = None
    campus_involvements: str | None = None
    professional_experience: str | None = None
    interests: str | None = None
    bio: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


class MembershipDetail(MembershipPublic):
    """Single-record response — includes the linked user's name and email."""
    user_name: str
    user_email: str


class ProfileEditRequestCreate(BaseModel):
    changes: dict  # { field_name: new_value }


class ProfileEditRequestPublic(BaseModel):
    id: uuid.UUID
    membership_id: uuid.UUID
    reviewed_by_id: uuid.UUID | None
    changes: dict
    status: str
    reviewer_note: str | None

    model_config = {"from_attributes": True}


class ProfileEditReview(BaseModel):
    status: str  # "approved" | "rejected"
    reviewer_note: str | None = None
