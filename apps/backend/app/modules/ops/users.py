import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.schemas.user import UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


class UserRoleUpdate(BaseModel):
    role: UserRole


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserPublic)
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        current_user.name = body.name
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("", response_model=list[UserPublic])
async def list_users(
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.name))
    return result.scalars().all()


@router.patch("/{user_id}/role", response_model=UserPublic)
async def update_user_role(
    user_id: uuid.UUID,
    body: UserRoleUpdate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return user
