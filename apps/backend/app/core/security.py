from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import structlog
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = structlog.get_logger()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "RS256"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire, "type": "access", **(extra or {})}
    return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": subject, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_PUBLIC_KEY, algorithms=[ALGORITHM])


def hash_token(token: str) -> str:
    return pwd_context.hash(token)


def verify_token_hash(token: str, hashed: str) -> bool:
    return pwd_context.verify(token, hashed)


async def verify_google_id_token(id_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})

    if not resp.is_success:
        logger.warning("google_token_invalid", status=resp.status_code)
        raise ValueError("Invalid Google token")

    payload = resp.json()

    if payload.get("aud") != settings.GOOGLE_CLIENT_ID:
        logger.warning("google_token_audience_mismatch", aud=payload.get("aud"))
        raise ValueError("Invalid Google token: audience mismatch")

    hd = payload.get("hd")
    if hd != settings.ALLOWED_HD:
        logger.warning("google_hd_rejected", hd=hd, allowed=settings.ALLOWED_HD)
        raise ValueError("Only @cornell.edu accounts are allowed")

    logger.info("google_token_verified", email=payload.get("email"), hd=hd)
    return payload
