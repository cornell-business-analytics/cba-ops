import uuid as uuid_lib
from typing import Any

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.core.middleware import limiter
from app.models.user import User
from app.modules.ops.deps import get_current_user
from app.services.images import DEFAULT_PURPOSE, EXTENSIONS, PURPOSES, normalize_image

router = APIRouter(prefix="/assets", tags=["assets"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "application/pdf",
}


class UploadResponse(BaseModel):
    public_url: str
    key: str


def _get_r2_client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


@router.post("/upload", response_model=UploadResponse)
@limiter.limit("20/minute")
async def upload_asset(
    request: Request,
    file: UploadFile = File(...),
    purpose: str = Form(DEFAULT_PURPOSE),
    current_user: User = Depends(get_current_user),
):
    if purpose not in PURPOSES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown purpose '{purpose}' (expected one of: {', '.join(sorted(PURPOSES))})",
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Content type not allowed: {file.content_type}")

    if not settings.R2_ACCESS_KEY_ID:
        raise HTTPException(status_code=503, detail="Asset storage not configured")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    # Re-encode before storing. Uploads reach the public site byte-for-byte via
    # the design-agent, so this is the only place we can guarantee they are
    # canonical and web-sized. See app/services/images.py for the full rationale.
    try:
        content, stored_type = normalize_image(content, file.content_type, purpose)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Derive the extension from what we actually encoded, not from the uploaded
    # filename — some purposes re-encode to a different format, and a key whose
    # extension disagrees with its bytes is a problem waiting to happen.
    filename = file.filename or ""
    fallback_ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
    ext = EXTENSIONS.get(stored_type, fallback_ext)
    user_id = str(current_user.id)
    key = f"uploads/{user_id}/{uuid_lib.uuid4()}"
    if ext:
        key = f"{key}.{ext}"

    _get_r2_client().put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=content,
        ContentType=stored_type or "application/octet-stream",
    )

    return UploadResponse(public_url=f"{settings.R2_PUBLIC_URL}/{key}", key=key)
