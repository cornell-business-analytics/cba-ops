import uuid as uuid_lib
from typing import Any

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.models.user import User
from app.modules.ops.deps import get_current_user

router = APIRouter(prefix="/assets", tags=["assets"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}


class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class UploadUrlResponse(BaseModel):
    upload_url: str
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


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    body: UploadUrlRequest,
    current_user: User = Depends(get_current_user),
):
    if body.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Content type not allowed: {body.content_type}")

    ext = body.filename.rsplit(".", 1)[-1] if "." in body.filename else ""
    key = f"uploads/{current_user.id}/{uuid_lib.uuid4()}.{ext}" if ext else f"uploads/{current_user.id}/{uuid_lib.uuid4()}"

    if not settings.R2_ACCESS_KEY_ID:
        raise HTTPException(status_code=503, detail="Asset storage not configured")

    client = _get_r2_client()
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": key,
            "ContentType": body.content_type,
        },
        ExpiresIn=300,  # 5 minutes
    )

    public_url = f"{settings.R2_PUBLIC_URL}/{key}"
    return UploadUrlResponse(upload_url=upload_url, public_url=public_url, key=key)
