import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.candidate import (
    ApplicationCycle,
    InterviewCategory,
    InterviewRound,
    InterviewSession,
)
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.schemas.cycle import (
    CycleCreate,
    CyclePublic,
    CycleUpdate,
    InterviewRoundCreate,
    InterviewRoundPublic,
    InterviewSessionCreate,
    InterviewSessionPublic,
)

router = APIRouter(tags=["cycles"])


# ---------------------------------------------------------------------------
# Application cycles
# ---------------------------------------------------------------------------

@router.get("/cycles", response_model=list[CyclePublic])
async def list_cycles(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).order_by(ApplicationCycle.name))
    return result.scalars().all()


@router.post("/cycles", response_model=CyclePublic, status_code=status.HTTP_201_CREATED)
async def create_cycle(
    body: CycleCreate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    cycle = ApplicationCycle(**body.model_dump())
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    return cycle


@router.patch("/cycles/{cycle_id}", response_model=CyclePublic)
async def update_cycle(
    cycle_id: uuid.UUID,
    body: CycleUpdate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cycle, field, value)
    await db.commit()
    await db.refresh(cycle)
    return cycle


# ---------------------------------------------------------------------------
# Interview rounds
# ---------------------------------------------------------------------------

@router.get("/cycles/{cycle_id}/rounds", response_model=list[InterviewRoundPublic])
async def list_rounds(
    cycle_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.cycle_id == cycle_id)
        .options(selectinload(InterviewRound.categories))
        .order_by(InterviewRound.round_number)
    )
    return result.scalars().all()


@router.post(
    "/cycles/{cycle_id}/rounds",
    response_model=InterviewRoundPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_round(
    cycle_id: uuid.UUID,
    body: InterviewRoundCreate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    round_ = InterviewRound(
        cycle_id=cycle_id,
        round_number=body.round_number,
        name=body.name,
        score_format=body.score_format,
        interview_format=body.interview_format,
        is_default=body.is_default,
    )
    db.add(round_)
    await db.flush()

    for cat in body.categories:
        db.add(InterviewCategory(round_id=round_.id, **cat.model_dump()))

    await db.commit()
    await db.refresh(round_)

    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.id == round_.id)
        .options(selectinload(InterviewRound.categories))
    )
    return result.scalar_one()


@router.delete("/rounds/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_round(
    round_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(InterviewRound).where(InterviewRound.id == round_id))
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    await db.delete(round_)
    await db.commit()


# ---------------------------------------------------------------------------
# Interview sessions
# ---------------------------------------------------------------------------

@router.get("/rounds/{round_id}/sessions", response_model=list[InterviewSessionPublic])
async def list_sessions(
    round_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.round_id == round_id)
        .order_by(InterviewSession.time_slot)
    )
    return result.scalars().all()


@router.post(
    "/rounds/{round_id}/sessions",
    response_model=InterviewSessionPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    round_id: uuid.UUID,
    body: InterviewSessionCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    session = InterviewSession(round_id=round_id, **body.model_dump())
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
