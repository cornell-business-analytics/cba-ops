import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.membership import Membership, ProfileEditRequest
from app.models.user import AllowedEmail, User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.schemas.member import (
    MembershipCreate,
    MembershipDetail,
    MembershipPublic,
    MembershipUpdate,
    ProfileEditRequestCreate,
    ProfileEditRequestPublic,
    ProfileEditReview,
)

router = APIRouter(tags=["members"])

MEMBER_EDITABLE_FIELDS = {
    "bio", "interests", "campus_involvements", "professional_experience",
    "professional_is_interests", "hometown", "linkedin_url", "major", "grad_year",
}


async def _revalidate_member(user_id: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.WEBSITE_URL}/api/revalidate",
                params={"secret": settings.REVALIDATE_SECRET, "tag": "members"},
            )
            await client.post(
                f"{settings.WEBSITE_URL}/api/revalidate",
                params={"secret": settings.REVALIDATE_SECRET, "tag": f"member-{user_id}"},
            )
    except httpx.HTTPError:
        pass


# ---------------------------------------------------------------------------
# Memberships
# ---------------------------------------------------------------------------

@router.get("/members", response_model=list[MembershipDetail])
async def list_members(
    cohort_id: uuid.UUID | None = None,
    active_only: bool = False,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Membership).options(selectinload(Membership.user))
    if active_only:
        query = query.where(Membership.is_active == True)
    if cohort_id:
        query = query.where(Membership.cohort_id == cohort_id)
    result = await db.execute(query.order_by(Membership.display_order))
    members = result.scalars().all()
    return [
        {**{c.key: getattr(m, c.key) for c in m.__table__.columns}, "user_name": m.user.name, "user_email": m.user.email}
        for m in members
    ]


@router.post("/members", response_model=MembershipPublic, status_code=status.HTTP_201_CREATED)
async def create_membership(
    body: MembershipCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Membership).where(
            Membership.user_id == body.user_id, Membership.cohort_id == body.cohort_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists in this cohort")

    membership = Membership(**body.model_dump())
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


class MemberInviteCreate(BaseModel):
    email: str
    name: str = ""
    cohort_id: uuid.UUID | None = None
    role_title: str = "Analyst"
    grad_year: str | None = None
    major: str | None = None


@router.post("/members/invite", response_model=MembershipPublic, status_code=status.HTTP_201_CREATED)
async def invite_member(
    body: MemberInviteCreate,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    email = body.email.strip().lower()

    # Add to allowlist if not already there
    allowed = await db.execute(select(AllowedEmail).where(AllowedEmail.email == email))
    if not allowed.scalar_one_or_none():
        db.add(AllowedEmail(email=email, added_by_id=current_user.id))

    # Find or create placeholder user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            email=email,
            name=body.name or email.split("@")[0],
            google_sub=f"pending:{email}",
        )
        db.add(user)
        await db.flush()

    # Check for duplicate membership (only when cohort is specified)
    if body.cohort_id is not None:
        existing = await db.execute(
            select(Membership).where(Membership.user_id == user.id, Membership.cohort_id == body.cohort_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists in this cohort")

    membership = Membership(
        user_id=user.id,
        cohort_id=body.cohort_id,
        role_title=body.role_title,
        grad_year=body.grad_year,
        major=body.major,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


@router.get("/members/{membership_id}", response_model=MembershipDetail)
async def get_membership(
    membership_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Membership)
        .options(selectinload(Membership.user))
        .where(Membership.id == membership_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")
    return {
        **{c.key: getattr(m, c.key) for c in m.__table__.columns},
        "user_name": m.user.name,
        "user_email": m.user.email,
    }


@router.patch("/members/{membership_id}", response_model=MembershipPublic)
async def update_membership(
    membership_id: uuid.UUID,
    body: MembershipUpdate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Membership).options(selectinload(Membership.user)).where(Membership.id == membership_id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    data = body.model_dump(exclude_none=True)
    if "name" in data:
        membership.user.name = data.pop("name")
    if "email" in data:
        membership.user.email = data.pop("email")
    for field, value in data.items():
        setattr(membership, field, value)
    await db.commit()
    await db.refresh(membership)
    await _revalidate_member(str(membership.user_id))
    return membership


class HeadshotUpdate(BaseModel):
    headshot_url: str | None = None
    headshot_focal_x: float | None = None
    headshot_focal_y: float | None = None


@router.patch("/members/{membership_id}/headshot", response_model=MembershipPublic)
async def update_headshot(
    membership_id: uuid.UUID,
    body: HeadshotUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Any member can update their own headshot or focal point; directors can update anyone's."""
    result = await db.execute(select(Membership).where(Membership.id == membership_id))
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    is_director = current_user.role in (UserRole.director, UserRole.eboard)
    is_own = membership.user_id == current_user.id
    if not is_director and not is_own:
        raise HTTPException(status_code=403, detail="Not authorized")

    if body.headshot_url is not None:
        membership.headshot_url = body.headshot_url
    if body.headshot_focal_x is not None:
        membership.headshot_focal_x = max(0.0, min(100.0, body.headshot_focal_x))
    if body.headshot_focal_y is not None:
        membership.headshot_focal_y = max(0.0, min(100.0, body.headshot_focal_y))
    await db.commit()
    await db.refresh(membership)
    await _revalidate_member(str(membership.user_id))
    return membership


# ---------------------------------------------------------------------------
# Profile edit requests (member submits, director reviews)
# ---------------------------------------------------------------------------

@router.post(
    "/members/{membership_id}/edit-requests",
    response_model=ProfileEditRequestPublic,
    status_code=status.HTTP_201_CREATED,
)
async def submit_edit_request(
    membership_id: uuid.UUID,
    body: ProfileEditRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Membership).where(
            Membership.id == membership_id, Membership.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Membership not found")

    invalid = set(body.changes.keys()) - MEMBER_EDITABLE_FIELDS
    if invalid:
        raise HTTPException(status_code=400, detail=f"Fields not editable: {', '.join(invalid)}")

    req = ProfileEditRequest(membership_id=membership_id, changes=body.changes)
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/edit-requests", response_model=list[ProfileEditRequestPublic])
async def list_edit_requests(
    pending_only: bool = True,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    query = select(ProfileEditRequest)
    if pending_only:
        query = query.where(ProfileEditRequest.status == "pending")
    result = await db.execute(query.order_by(ProfileEditRequest.created_at))
    return result.scalars().all()


@router.patch("/edit-requests/{request_id}/review", response_model=ProfileEditRequestPublic)
async def review_edit_request(
    request_id: uuid.UUID,
    body: ProfileEditReview,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProfileEditRequest).where(ProfileEditRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")

    req.status = body.status
    req.reviewed_by_id = current_user.id
    req.reviewer_note = body.reviewer_note

    if body.status == "approved":
        m_result = await db.execute(
            select(Membership).where(Membership.id == req.membership_id)
        )
        membership = m_result.scalar_one_or_none()
        if membership:
            for field, value in req.changes.items():
                if field in MEMBER_EDITABLE_FIELDS:
                    setattr(membership, field, value)

    await db.commit()
    await db.refresh(req)
    return req
