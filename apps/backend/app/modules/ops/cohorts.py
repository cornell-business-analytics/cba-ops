import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.membership import Cohort
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role

router = APIRouter(prefix="/cohorts", tags=["cohorts"])


class CohortPublic(BaseModel):
    id: uuid.UUID
    semester: str

    model_config = {"from_attributes": True}


class CohortCreate(BaseModel):
    semester: str


@router.get("", response_model=list[CohortPublic])
async def list_cohorts(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cohort).order_by(Cohort.semester.desc()))
    return result.scalars().all()


@router.post("", response_model=CohortPublic, status_code=status.HTTP_201_CREATED)
async def create_cohort(
    body: CohortCreate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Cohort).where(Cohort.semester == body.semester))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cohort already exists")

    cohort = Cohort(semester=body.semester)
    db.add(cohort)
    await db.commit()
    await db.refresh(cohort)
    return cohort
