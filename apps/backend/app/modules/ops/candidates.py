import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.candidate import (
    ApplicationCycle,
    Candidate,
    CandidateStatus,
    CoffeeChat,
    InterviewScore,
)
from app.models.recruitment import CoffeeChatEvaluation
from app.models.membership import Membership
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.schemas.candidate import (
    CandidateCreate,
    CandidatePublic,
    CandidateStatusUpdate,
    CandidateUpdate,
    CoffeeChatAssign,
    CoffeeChatPublic,
    CoffeeChatUpdate,
    InterviewScoreCreate,
    InterviewScorePublic,
)

router = APIRouter(tags=["candidates"])


# ---------------------------------------------------------------------------
# Candidates
# ---------------------------------------------------------------------------

@router.get("/candidates", response_model=list[CandidatePublic])
async def list_candidates(
    cycle_id: uuid.UUID | None = None,
    status: CandidateStatus | None = None,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    query = select(Candidate).order_by(Candidate.name)
    if cycle_id:
        query = query.where(Candidate.cycle_id == cycle_id)
    if status:
        query = query.where(Candidate.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/candidates", response_model=CandidatePublic, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    body: CandidateCreate,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    candidate = Candidate(**body.model_dump())
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


@router.get("/candidates/{candidate_id}", response_model=CandidatePublic)
async def get_candidate(
    candidate_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.patch("/candidates/{candidate_id}", response_model=CandidatePublic)
async def update_candidate(
    candidate_id: uuid.UUID,
    body: CandidateUpdate,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(candidate, field, value)
    await db.commit()
    await db.refresh(candidate)
    return candidate


@router.patch("/candidates/{candidate_id}/status", response_model=CandidatePublic)
async def update_candidate_status(
    candidate_id: uuid.UUID,
    body: CandidateStatusUpdate,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.status = body.status
    await db.commit()
    await db.refresh(candidate)
    return candidate


# ---------------------------------------------------------------------------
# Coffee chats
# ---------------------------------------------------------------------------

@router.get("/candidates/{candidate_id}/coffee-chats", response_model=list[CoffeeChatPublic])
async def get_coffee_chats(
    candidate_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoffeeChat, User.name.label("member_name"))
        .join(User, CoffeeChat.member_id == User.id)
        .where(CoffeeChat.candidate_id == candidate_id)
    )
    rows = result.all()
    return [
        CoffeeChatPublic(
            id=chat.id,
            candidate_id=chat.candidate_id,
            member_id=chat.member_id,
            member_name=member_name,
            score=chat.score,
            notes=chat.notes,
            completed=chat.completed,
        )
        for chat, member_name in rows
    ]


@router.post(
    "/candidates/{candidate_id}/coffee-chats",
    response_model=CoffeeChatPublic,
    status_code=status.HTTP_201_CREATED,
)
async def assign_coffee_chat(
    candidate_id: uuid.UUID,
    body: CoffeeChatAssign,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(CoffeeChat).where(CoffeeChat.candidate_id == candidate_id)
    )
    existing_chats = existing.scalars().all()
    if len(existing_chats) >= 3:
        raise HTTPException(status_code=400, detail="Candidate already has 3 coffee chats assigned")
    if any(c.member_id == body.member_id for c in existing_chats):
        raise HTTPException(status_code=400, detail="Member already assigned to this candidate")

    chat = CoffeeChat(candidate_id=candidate_id, member_id=body.member_id)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


@router.post(
    "/candidates/{candidate_id}/coffee-chats/auto",
    response_model=CoffeeChatPublic,
    status_code=status.HTTP_201_CREATED,
)
async def auto_assign_coffee_chat(
    candidate_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    candidate_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = candidate_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    existing_result = await db.execute(
        select(CoffeeChat).where(CoffeeChat.candidate_id == candidate_id)
    )
    existing_chats = existing_result.scalars().all()
    if len(existing_chats) >= 3:
        raise HTTPException(status_code=400, detail="Candidate already has 3 coffee chats assigned")

    assigned_ids = {c.member_id for c in existing_chats}

    # Get the cycle's cohort to find eligible members
    cycle_result = await db.execute(
        select(ApplicationCycle).where(ApplicationCycle.id == candidate.cycle_id)
    )
    cycle = cycle_result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=400, detail="Candidate has no cycle")

    members_result = await db.execute(
        select(Membership.user_id).where(
            Membership.is_active == True,
            Membership.user_id.not_in(assigned_ids) if assigned_ids else True,
        )
    )
    eligible_ids = [row[0] for row in members_result.all()]
    if not eligible_ids:
        raise HTTPException(status_code=400, detail="No eligible members available")

    # Pick member with fewest total coffee chat assignments
    counts_result = await db.execute(
        select(CoffeeChat.member_id, func.count(CoffeeChat.id))
        .where(CoffeeChat.member_id.in_(eligible_ids))
        .group_by(CoffeeChat.member_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}
    best_member_id = min(eligible_ids, key=lambda mid: counts.get(mid, 0))

    chat = CoffeeChat(candidate_id=candidate_id, member_id=best_member_id)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


@router.patch("/coffee-chats/{chat_id}", response_model=CoffeeChatPublic)
async def update_coffee_chat(
    chat_id: uuid.UUID,
    body: CoffeeChatUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CoffeeChat).where(CoffeeChat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Coffee chat not found")

    from app.modules.ops.deps import ROLE_ORDER
    from app.models.user import UserRole
    is_director_plus = ROLE_ORDER[current_user.role] >= ROLE_ORDER[UserRole.director]
    if chat.member_id != current_user.id and not is_director_plus:
        raise HTTPException(status_code=403, detail="Can only update your own coffee chats")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(chat, field, value)
    await db.commit()
    await db.refresh(chat)
    return chat


# ---------------------------------------------------------------------------
# Interview scores
# ---------------------------------------------------------------------------

@router.post("/interview-scores", response_model=InterviewScorePublic, status_code=status.HTTP_201_CREATED)
async def submit_interview_score(
    body: InterviewScoreCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    score = InterviewScore(
        **body.model_dump(),
        member_id=current_user.id,
    )
    db.add(score)
    await db.commit()
    await db.refresh(score)
    return score


@router.get("/candidates/{candidate_id}/scores", response_model=list[InterviewScorePublic])
async def get_candidate_scores(
    candidate_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewScore).where(InterviewScore.candidate_id == candidate_id)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Coffee chat evaluations (member feedback from evaluation sheet)
# ---------------------------------------------------------------------------

class CoffeeChatEvaluationPublic(BaseModel):
    id: uuid.UUID
    cycle_id: uuid.UUID
    applicant_name: str
    applicant_email: str
    member_name: str
    chat_date: str | None
    score: float | None
    comments: str | None
    model_config = {"from_attributes": True}


@router.get("/candidates/{candidate_id}/coffee-chat-evaluations", response_model=list[CoffeeChatEvaluationPublic])
async def get_candidate_evaluations(
    candidate_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.pm)),
    db: AsyncSession = Depends(get_db),
):
    cand_result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    result = await db.execute(
        select(CoffeeChatEvaluation)
        .where(
            or_(
                func.lower(CoffeeChatEvaluation.applicant_email) == candidate.cornell_email.lower(),
                func.lower(CoffeeChatEvaluation.applicant_email) == candidate.email.lower(),
            )
        )
        .order_by(CoffeeChatEvaluation.created_at)
    )
    return result.scalars().all()
