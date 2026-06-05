import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import AllowedEmail, User, UserRole
from app.modules.ops.deps import require_role

router = APIRouter(prefix="/access", tags=["access"])


class AllowedEmailPublic(BaseModel):
    id: uuid.UUID
    email: str
    added_by_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AllowedEmailCreate(BaseModel):
    email: str


@router.get("/allowed-emails", response_model=list[AllowedEmailPublic])
async def list_allowed_emails(
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AllowedEmail).order_by(AllowedEmail.created_at.desc()))
    return result.scalars().all()


@router.post(
    "/allowed-emails",
    response_model=AllowedEmailPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_allowed_email(
    body: AllowedEmailCreate,
    current_user: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(AllowedEmail).where(AllowedEmail.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in allowlist")

    entry = AllowedEmail(email=body.email, added_by_id=current_user.id)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/allowed-emails/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_allowed_email(
    entry_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AllowedEmail).where(AllowedEmail.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
