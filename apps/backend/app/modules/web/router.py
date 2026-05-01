from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.membership import Membership
from app.models.org import Event, EventType
from app.models.page import Page, PageStatus
from app.models.setting import SiteSetting
from app.schemas.event import EventPublic
from app.schemas.member import MemberPublic
from app.schemas.page import PagePublic

router = APIRouter(tags=["web"])


@router.get("/health")
async def web_health():
    return {"status": "ok"}


@router.get("/members", response_model=list[MemberPublic])
async def get_members(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Membership)
        .where(Membership.is_active == True)
        .options(selectinload(Membership.user), selectinload(Membership.cohort))
        .order_by(Membership.display_order)
    )
    memberships = result.scalars().all()

    return [
        MemberPublic(
            id=m.user.id,
            name=m.user.name,
            email=m.user.email,
            role_title=m.role_title,
            major=m.major,
            grad_year=m.grad_year,
            hometown=m.hometown,
            campus_involvements=m.campus_involvements,
            professional_experience=m.professional_experience,
            interests=m.interests,
            bio=m.bio,
            headshot_url=m.headshot_url,
            cohort_semester=m.cohort.semester,
        )
        for m in memberships
    ]


@router.get("/events", response_model=list[EventPublic])
async def get_events(
    type: EventType | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Event).where(Event.is_published == True).order_by(Event.event_date)
    if type:
        query = query.where(Event.type == type)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/recruitment-steps")
async def get_recruitment_steps(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == "recruitment_steps"))
    row = result.scalar_one_or_none()
    return row.value if row else []


@router.get("/pages/{slug}", response_model=PagePublic)
async def get_page(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Page).where(Page.slug == slug, Page.status == PageStatus.published)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page
