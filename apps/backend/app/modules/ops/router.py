import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.modules.ops.analytics import router as analytics_router
from app.modules.ops.assets import router as assets_router
from app.modules.ops.auth import router as auth_router
from app.modules.ops.candidates import router as candidates_router
from app.modules.ops.cycles import router as cycles_router
from app.modules.ops.events import router as events_router
from app.modules.ops.members import router as members_router
from app.modules.ops.pages import router as pages_router
from app.modules.ops.settings import router as settings_router
from app.modules.ops.users import router as users_router
from app.modules.ops.deps import require_role
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(tags=["ops"])

router.include_router(auth_router)
router.include_router(users_router)
router.include_router(members_router)
router.include_router(candidates_router)
router.include_router(cycles_router)
router.include_router(pages_router)
router.include_router(events_router)
router.include_router(assets_router)
router.include_router(analytics_router)
router.include_router(settings_router)


class AuditLogPublic(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    payload: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/audit-log", response_model=list[AuditLogPublic], tags=["audit"])
async def get_audit_log(
    limit: int = 100,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    return result.scalars().all()
