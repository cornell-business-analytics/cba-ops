import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.org import Event
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.schemas.event import EventCreate, EventPublic, EventUpdate

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventPublic])
async def list_events(
    published_only: bool = False,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Event).order_by(Event.event_date)
    if published_only:
        query = query.where(Event.is_published == True)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=EventPublic, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    event = Event(**body.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.get("/{event_id}", response_model=EventPublic)
async def get_event(
    event_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=EventPublic)
async def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(event, field, value)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
