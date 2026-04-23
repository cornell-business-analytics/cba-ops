import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_google_id_token,
    verify_token_hash,
)
from app.db.session import get_db
from app.models.user import User, UserSession
from app.schemas.auth import GoogleAuthRequest, LogoutRequest, RefreshRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        google_payload = await verify_google_id_token(body.id_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    google_sub = google_payload["sub"]
    email = google_payload["email"]
    name = google_payload.get("name", email.split("@")[0])

    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(email=email, name=name, google_sub=google_sub)
        db.add(user)
        await db.flush()
    else:
        user.email = email
        user.name = name

    raw_refresh = create_refresh_token(str(user.id))
    session = UserSession(user_id=user.id, refresh_token_hash=hash_token(raw_refresh))
    db.add(session)
    await db.commit()

    access_token = create_access_token(str(user.id), extra={"role": user.role})
    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(
        select(UserSession).where(UserSession.user_id == user_id, UserSession.is_revoked == False)
    )
    sessions = result.scalars().all()

    matched = next(
        (s for s in sessions if verify_token_hash(body.refresh_token, s.refresh_token_hash)), None
    )
    if not matched:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found or revoked")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    matched.is_revoked = True
    new_refresh = create_refresh_token(str(user.id))
    db.add(UserSession(user_id=user.id, refresh_token_hash=hash_token(new_refresh)))
    await db.commit()

    access_token = create_access_token(str(user.id), extra={"role": user.role})
    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.delete("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(body.refresh_token)
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        return  # token already invalid — treat as successful logout

    result = await db.execute(
        select(UserSession).where(UserSession.user_id == user_id, UserSession.is_revoked == False)
    )
    sessions = result.scalars().all()
    matched = next(
        (s for s in sessions if verify_token_hash(body.refresh_token, s.refresh_token_hash)), None
    )
    if matched:
        matched.is_revoked = True
        await db.commit()
