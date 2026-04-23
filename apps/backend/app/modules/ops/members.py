import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.membership import Membership, ProfileEditRequest
from app.models.user import User, UserRole
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


# ---------------------------------------------------------------------------
# Memberships
# ---------------------------------------------------------------------------

@router.get("/members", response_model=list[MembershipPublic])
async def list_members(
    cohort_id: uuid.UUID | None = None,
    active_only: bool = True,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Membership)
    if active_only:
        query = query.where(Membership.is_active == True)
    if cohort_id:
        query = query.where(Membership.cohort_id == cohort_id)
    result = await db.execute(query.order_by(Membership.display_order))
    return result.scalars().all()


@router.post("/members", response_model=MembershipPublic, status_code=status.HTTP_201_CREATED)
async def create_membership(
    body: MembershipCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    membership = Membership(**body.model_dump())
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
    result = await db.execute(select(Membership).where(Membership.id == membership_id))
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(membership, field, value)
    await db.commit()
    await db.refresh(membership)
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
                if hasattr(membership, field):
                    setattr(membership, field, value)

    await db.commit()
    await db.refresh(req)
    return req
