import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache
from app.db.session import get_db
from app.models.candidate import ApplicationCycle, Candidate, CandidateStatus, CoffeeChat
from app.models.membership import Cohort, Membership
from app.models.org import Event
from app.models.page import Page, PageStatus
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role

_ANALYTICS_TTL = 120  # 2 minutes

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cached = await cache.get_json("analytics:overview")
    if cached is not None:
        return cached

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

    total_coffee_chats = await db.scalar(
        select(func.count(CoffeeChat.id)).where(CoffeeChat.completed == True)
    )
    unique_coffee_chats = await db.scalar(
        select(func.count(func.distinct(CoffeeChat.candidate_id))).where(CoffeeChat.completed == True)
    )

    result = {
        "total_members": total_members or 0,
        "active_candidates": active_candidates or 0,
        "published_pages": published_pages or 0,
        "events_this_semester": events_this_semester or 0,
        "total_coffee_chats": total_coffee_chats or 0,
        "unique_coffee_chats": unique_coffee_chats or 0,
    }
    await cache.set_json("analytics:overview", result, ttl=_ANALYTICS_TTL)
    return result


@router.get("/recruitment")
async def recruitment_funnel(
    cycle_id: uuid.UUID | None = None,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"analytics:recruitment:{cycle_id or 'active'}"
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return cached

    if not cycle_id:
        result = await db.execute(
            select(ApplicationCycle).where(ApplicationCycle.is_active == True)
        )
        cycle = result.scalar_one_or_none()
        if not cycle:
            return {"cycle_id": None, "funnel": {}, "total_applicants": 0, "offers": 0, "acceptance_rate": 0.0, "cycles": []}
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

    total_applicants = funnel.get("applied", 0)
    offers = funnel.get("offer", 0)
    accepted = funnel.get("accepted", 0)
    acceptance_rate = round(accepted / offers, 4) if offers > 0 else 0.0

    # Per-cycle stats across all cycles for historical comparison
    cycles_result = await db.execute(
        select(
            ApplicationCycle.id,
            ApplicationCycle.name,
            func.count(Candidate.id).label("total_applicants"),
            func.coalesce(
                func.sum(
                    case(
                        (Candidate.status.in_([CandidateStatus.offer, CandidateStatus.accepted]), 1),
                        else_=0,
                    )
                ),
                0,
            ).label("offers"),
            func.coalesce(
                func.sum(
                    case(
                        (Candidate.status == CandidateStatus.accepted, 1),
                        else_=0,
                    )
                ),
                0,
            ).label("accepted"),
        )
        .join(Candidate, Candidate.cycle_id == ApplicationCycle.id, isouter=True)
        .group_by(ApplicationCycle.id, ApplicationCycle.name)
        .order_by(ApplicationCycle.created_at)
    )
    cycles = []
    for row in cycles_result.all():
        c_offers = row.offers or 0
        c_accepted = row.accepted or 0
        cycles.append(
            {
                "cycle_id": str(row.id),
                "name": row.name,
                "total_applicants": row.total_applicants or 0,
                "offers": c_offers,
                "accepted": c_accepted,
                "acceptance_rate": round(c_accepted / c_offers * 100, 1) if c_offers else 0.0,
            }
        )

    result = {
        "cycle_id": str(cycle_id) if cycle_id else None,
        "funnel": funnel,
        "total_applicants": total_applicants,
        "offers": offers,
        "acceptance_rate": acceptance_rate,
        "cycles": cycles,
    }
    await cache.set_json(cache_key, result, ttl=_ANALYTICS_TTL)
    return result


@router.get("/members")
async def members_analytics(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cached = await cache.get_json("analytics:members")
    if cached is not None:
        return cached

    grad_result = await db.execute(
        select(Membership.grad_year, func.count(Membership.id).label("count"))
        .where(Membership.is_active == True, Membership.grad_year.is_not(None))
        .group_by(Membership.grad_year)
        .order_by(Membership.grad_year)
    )
    grad_year_distribution = {row.grad_year: row.count for row in grad_result.all()}

    major_result = await db.execute(
        select(Membership.major)
        .where(Membership.is_active == True, Membership.major.is_not(None))
    )
    major_counts: dict[str, int] = {}
    for (raw,) in major_result.all():
        for part in raw.split("+"):
            major = part.strip()
            if major:
                major_counts[major] = major_counts.get(major, 0) + 1
    major_distribution = dict(sorted(major_counts.items(), key=lambda x: x[1], reverse=True))

    result = {"grad_year_distribution": grad_year_distribution, "major_distribution": major_distribution}
    await cache.set_json("analytics:members", result, ttl=_ANALYTICS_TTL)
    return result
