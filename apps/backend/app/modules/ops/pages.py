import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.page import Page, PageStatus
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.schemas.page import PageCreate, PagePublic, PageUpdate

router = APIRouter(prefix="/pages", tags=["pages"])


@router.get("", response_model=list[PagePublic])
async def list_pages(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Page).order_by(Page.slug))
    return result.scalars().all()


@router.post("", response_model=PagePublic, status_code=status.HTTP_201_CREATED)
async def create_page(
    body: PageCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Page).where(Page.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already exists")
    page = Page(**body.model_dump())
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return page


@router.get("/{slug}", response_model=PagePublic)
async def get_page(
    slug: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Page).where(Page.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.patch("/{slug}", response_model=PagePublic)
async def update_page(
    slug: str,
    body: PageUpdate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Page).where(Page.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(page, field, value)
    await db.commit()
    await db.refresh(page)
    return page


@router.post("/{slug}/publish", response_model=PagePublic)
async def publish_page(
    slug: str,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Page).where(Page.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    page.status = PageStatus.published
    await db.commit()
    await db.refresh(page)

    # Trigger ISR revalidation on the website
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.WEBSITE_URL}/api/revalidate",
                params={"secret": settings.REVALIDATE_SECRET, "tag": f"page-{slug}"},
            )
    except httpx.HTTPError:
        pass  # publish succeeded; revalidation failure is non-fatal

    return page


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(
    slug: str,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Page).where(Page.slug == slug))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    await db.delete(page)
    await db.commit()
