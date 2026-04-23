from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "RS256"
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"


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
        certs_resp = await client.get(GOOGLE_CERTS_URL)
        certs_resp.raise_for_status()

    try:
        payload = jwt.decode(
            id_token,
            certs_resp.json(),
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID,
        )
    except JWTError as e:
        raise ValueError(f"Invalid Google token: {e}") from e

    if payload.get("hd") != settings.ALLOWED_HD:
        raise ValueError("Only @cornell.edu accounts are allowed")

    return payload
