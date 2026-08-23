import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.membership import Membership
from app.models.org import Event, EventType
from app.models.page import Page, PageStatus
from app.models.setting import SiteSetting
from app.schemas.event import EventPublic
from app.schemas.member import MemberPublic
from app.schemas.page import PagePublic

router = APIRouter(tags=["web"])


@router.get("/assets/{key:path}", include_in_schema=False)
def proxy_asset(key: str):
    """Serve R2 assets through the backend using credentials — no public bucket access needed."""
    if not settings.R2_ACCESS_KEY_ID:
        raise HTTPException(status_code=503, detail="Asset storage not configured")
    r2 = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )
    try:
        obj = r2.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        body = obj["Body"].read()
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("NoSuchKey", "404"):
            raise HTTPException(status_code=404, detail="Asset not found")
        raise HTTPException(status_code=502, detail="Could not fetch asset")
    return Response(
        content=body,
        media_type=obj.get("ContentType", "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get("/health")
async def web_health():
    return {"status": "ok"}


@router.get("/members/{member_id}", response_model=MemberPublic)
async def get_member(
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Membership)
        .where(Membership.user_id == member_id)
        .options(selectinload(Membership.user), selectinload(Membership.cohort))
        .order_by(Membership.display_order)
        .limit(1)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    return MemberPublic(
        id=m.user.id,
        name=m.user.name,
        email=m.user.email,
        role=m.user.role.value,
        role_title=m.role_title,
        is_active=m.is_active,
        major=m.major,
        grad_year=m.grad_year,
        hometown=m.hometown,
        campus_involvements=m.campus_involvements,
        professional_experience=m.professional_experience,
        professional_is_interests=m.professional_is_interests,
        interests=m.interests,
        bio=m.bio,
        headshot_url=m.headshot_url,
        headshot_focal_x=m.headshot_focal_x,
        headshot_focal_y=m.headshot_focal_y,
        linkedin_url=m.linkedin_url,
        cohort_semester=m.cohort.semester if m.cohort else "",
    )


@router.get("/members", response_model=list[MemberPublic])
async def get_members(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Membership)
        .options(selectinload(Membership.user), selectinload(Membership.cohort))
        .order_by(Membership.display_order)
    )
    memberships = result.scalars().all()

    out = []
    for m in memberships:
        effective_role = m.website_role or m.user.role.value
        if effective_role == "hidden":
            continue
        out.append(MemberPublic(
            id=m.user.id,
            name=m.user.name,
            email=m.user.email,
            role=effective_role,
            role_title=m.role_title,
            is_active=m.is_active,
            major=m.major,
            grad_year=m.grad_year,
            hometown=m.hometown,
            campus_involvements=m.campus_involvements,
            professional_experience=m.professional_experience,
            professional_is_interests=m.professional_is_interests,
            interests=m.interests,
            bio=m.bio,
            headshot_url=m.headshot_url,
            headshot_focal_x=m.headshot_focal_x,
            headshot_focal_y=m.headshot_focal_y,
            linkedin_url=m.linkedin_url,
            cohort_semester=m.cohort.semester if m.cohort else "",
        ))
    return out


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


@router.get("/recruitment-no-events-message")
async def get_recruitment_no_events_message(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == "recruitment_no_events_message"))
    row = result.scalar_one_or_none()
    return {"message": row.value if row else ""}


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
