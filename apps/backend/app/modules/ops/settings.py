import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.setting import SiteSetting
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role

router = APIRouter(prefix="/settings", tags=["settings"])


class RecruitmentStep(BaseModel):
    title: str
    desc: str


@router.get("/recruitment-steps", response_model=list[RecruitmentStep])
async def get_recruitment_steps(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == "recruitment_steps"))
    row = result.scalar_one_or_none()
    return row.value if row else []


@router.put("/recruitment-steps", response_model=list[RecruitmentStep])
async def update_recruitment_steps(
    steps: list[RecruitmentStep],
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == "recruitment_steps"))
    row = result.scalar_one_or_none()
    serialized = [s.model_dump() for s in steps]
    if row is None:
        db.add(SiteSetting(key="recruitment_steps", value=serialized))
    else:
        row.value = serialized
    await db.commit()

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.WEBSITE_URL}/api/revalidate",
                params={"secret": settings.REVALIDATE_SECRET, "tag": "recruitment-steps"},
            )
    except httpx.HTTPError:
        pass

    return steps
