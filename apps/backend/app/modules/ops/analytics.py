import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.candidate import ApplicationCycle, Candidate, CandidateStatus
from app.models.membership import Membership
from app.models.org import Event
from app.models.page import Page, PageStatus
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_members = await db.scalar(
        select(func.count(Membership.id)).where(Membership.is_active == True)
    )

    active_cycle_result = await db.execute(
        select(ApplicationCycle).where(ApplicationCycle.is_active == True)
    )
    active_cycle = active_cycle_result.scalar_one_or_none()
    active_candidates = 0
    if active_cycle:
        active_candidates = await db.scalar(
            select(func.count(Candidate.id)).where(
                Candidate.cycle_id == active_cycle.id,
                Candidate.status.not_in([CandidateStatus.rejected, CandidateStatus.withdrawn]),
            )
        )

    published_pages = await db.scalar(
        select(func.count(Page.id)).where(Page.status == PageStatus.published)
    )

    now = datetime.now(timezone.utc)
    semester_start = now.replace(
        month=1 if now.month < 7 else 8, day=1, hour=0, minute=0, second=0, microsecond=0
    )
    events_this_semester = await db.scalar(
        select(func.count(Event.id)).where(Event.event_date >= semester_start)
    )

    return {
        "total_members": total_members or 0,
        "active_candidates": active_candidates or 0,
        "published_pages": published_pages or 0,
        "events_this_semester": events_this_semester or 0,
    }


@router.get("/recruitment")
async def recruitment_funnel(
    cycle_id: uuid.UUID | None = None,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    if not cycle_id:
        result = await db.execute(
            select(ApplicationCycle).where(ApplicationCycle.is_active == True)
        )
        cycle = result.scalar_one_or_none()
        if not cycle:
            return {"cycle_id": None, "funnel": {}}
        cycle_id = cycle.id

    result = await db.execute(
        select(Candidate.status, func.count(Candidate.id))
        .where(Candidate.cycle_id == cycle_id)
        .group_by(Candidate.status)
    )
    counts = {row[0]: row[1] for row in result.all()}

    # Cumulative funnel — each stage includes everyone who reached it or further
    pipeline = [
        CandidateStatus.applied,
        CandidateStatus.coffee_chat,
        CandidateStatus.interviewing,
        CandidateStatus.offer,
        CandidateStatus.accepted,
    ]
    funnel: dict[str, int] = {}
    running = 0
    for stage in reversed(pipeline):
        running += counts.get(stage, 0)
        funnel[stage.value] = running

    return {"cycle_id": cycle_id, "funnel": funnel}
